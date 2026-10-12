import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, Info, AlertTriangle, CheckCircle2, Sun, Moon, Settings, ChevronDown, Bell, TimerReset } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateOvertime, formatMinutes, formatDecimal, getLegalMinimumBreak, getWorkTimeRules, WORK_COUNTRY_LABELS, type WorkCountry } from "@/lib/overtime";
import { WorkTimer } from "@/components/work-timer";
import { ShiftProgress } from "@/components/shift-progress";
import { EarningsPanel } from "@/components/earnings-panel";
import { LogPanel } from "@/components/log-panel";
import { OvertimeHistory } from "@/components/overtime-history";
import { addShiftRecord } from "@/lib/shift-history";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { VacationPanel } from "@/components/vacation-panel";
import { HolidayPanel } from "@/components/holiday-panel";
import {
  dueVacationReminders,
  loadReminderSettings,
  loadVacation,
  markReminderSent,
  saveReminderSettings,
  sendBrowserNotification,
  type ReminderSettings,
  type VacationPlan,
} from "@/lib/reminders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FORM_KEY = "overtime-calculator:form";
const OVERTIME_BALANCE_KEY = "overtime-calculator:initial-overtime-balance";
const DEFAULT_VALUES = {
  country: "de" as WorkCountry,
  model: "normal" as const,
  weekendShift: false,
  weekendShiftHours: 8,
  shiftStart: "09:00",
  shiftEnd: "17:30",
  breakMinutes: 30,
  clockIn: "08:50",
  clockOut: "18:00",
  countAfterSpecificTime: false,
  thresholdTime: "17:30",
  targetHours: 8,
  breakStartTime: "",
};

function loadForm() {
  try { return { ...DEFAULT_VALUES, ...JSON.parse(localStorage.getItem(FORM_KEY) ?? "{}") }; }
  catch { return DEFAULT_VALUES; }
}

const formSchema = z.object({
  country: z.enum(["de", "at", "ch"]),
  model: z.enum(["normal", "gleitzeit"]),
  weekendShift: z.boolean(),
  weekendShiftHours: z.coerce.number().min(0.25).max(24),
  shiftStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  shiftEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  breakMinutes: z.coerce.number().min(0),
  clockIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  clockOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  countAfterSpecificTime: z.boolean(),
  thresholdTime: z.string().optional(),
  targetHours: z.coerce.number().min(0).max(24),
  breakStartTime: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Load and save the user's already accumulated overtime locally.
function loadInitialOvertimeHours(): string {
  try {
    return localStorage.getItem(OVERTIME_BALANCE_KEY) ?? "0";
  } catch {
    return "0";
  }
}

function formatSignedMinutes(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "−" : "";
  return `${sign}${formatMinutes(Math.abs(minutes))}`;
}

// Derive the weekend shift end time from selected net hours and the planned break.
function addMinutesToTime(start: string, durationMinutes: number): string {
  const [hours, minutes] = start.split(":").map(Number);
  const totalMinutes = ((hours || 0) * 60 + (minutes || 0) + Math.round(durationMinutes)) % (24 * 60);
  return `${Math.floor(totalMinutes / 60).toString().padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`;
}

// Include any required statutory break when calculating a planned weekend shift end.
function plannedWeekendBreakMinutes(country: WorkCountry, netHours: number, configuredBreak: number): number {
  const selectedBreak = Math.max(0, Number(configuredBreak) || 0);
  let effectiveBreak = selectedBreak;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const required = getLegalMinimumBreak(country, Math.round(netHours * 60 + effectiveBreak));
    const next = Math.max(selectedBreak, required);
    if (next === effectiveBreak) break;
    effectiveBreak = next;
  }
  return effectiveBreak;
}

const INTERVAL_FIELDS = [
  { key: "vacationStartFirstDays", label: "Urlaub beginnt – erster Hinweis", unit: "Tage vorher" },
  { key: "vacationStartSecondDays", label: "Urlaub beginnt – zweiter Hinweis", unit: "Tage vorher" },
  { key: "vacationEndFirstDays", label: "Urlaubsende – erster Hinweis", unit: "Tage vorher" },
  { key: "vacationEndSecondDays", label: "Urlaubsende – zweiter Hinweis", unit: "Tage vorher" },
  { key: "breakEndFirstSeconds", label: "Pausenende – erster Hinweis", unit: "Sekunden vorher" },
  { key: "breakEndSecondSeconds", label: "Pausenende – zweiter Hinweis", unit: "Sekunden vorher" },
  { key: "breakStartMinutes", label: "Pausenbeginn", unit: "Minuten vorher" },
  { key: "shiftEndFirstMinutes", label: "Schichtende – erster Hinweis", unit: "Minuten vorher" },
  { key: "shiftEndSecondMinutes", label: "Schichtende – zweiter Hinweis", unit: "Minuten vorher" },
] as const;

export default function Home() {
  const { theme, toggle } = useTheme();
  const [liveWorkMs, setLiveWorkMs] = useState(0);
  const [liveBreakMs, setLiveBreakMs] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [initialOvertimeHours, setInitialOvertimeHours] = useState(loadInitialOvertimeHours);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(loadReminderSettings);
  const [vacation, setVacation] = useState<VacationPlan>(loadVacation);
  const [now, setNow] = useState(Date.now);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: loadForm(),
  });

  const values = useWatch({ control: form.control });
  const weekendWorkHours = Math.max(0.25, Number(values.weekendShiftHours ?? 8) || 8);
  const selectedBreakMinutes = values.weekendShift
    ? plannedWeekendBreakMinutes(values.country ?? "de", weekendWorkHours, Number(values.breakMinutes ?? 30))
    : Number(values.breakMinutes ?? 30);
  const selectedShiftEnd = values.weekendShift
    ? addMinutesToTime(
        values.shiftStart ?? "09:00",
        weekendWorkHours * 60 + selectedBreakMinutes,
      )
    : values.shiftEnd ?? "17:30";
  const selectedTargetHours = values.weekendShift
    ? weekendWorkHours
    : Number(values.targetHours ?? 8);

  useEffect(() => {
    try { localStorage.setItem(FORM_KEY, JSON.stringify(values)); } catch {}
  }, [values]);

  useEffect(() => {
    try { localStorage.setItem(OVERTIME_BALANCE_KEY, initialOvertimeHours); } catch {}
  }, [initialOvertimeHours]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateReminder = (key: "vacation" | "breakEnd" | "breakStart" | "shiftEnd", enabled: boolean) => {
    const next = { ...reminderSettings, [key]: enabled };
    setReminderSettings(next);
    saveReminderSettings(next);
  };

  const updateReminderInterval = (key: keyof Omit<ReminderSettings, "vacation" | "breakEnd" | "breakStart" | "shiftEnd">, value: number) => {
    const next = { ...reminderSettings, [key]: Math.max(0, value) };
    setReminderSettings(next);
    saveReminderSettings(next);
  };

  useEffect(() => {
    if (!reminderSettings.vacation) return;
    for (const reminder of dueVacationReminders(vacation, reminderSettings, now)) {
      if (!markReminderSent(reminder.id)) continue;
      sendBrowserNotification(reminder.title, reminder.body);
      toast({ title: reminder.title, description: reminder.body });
    }
  }, [now, vacation, reminderSettings.vacation, toast]);

  let result = null;
  try {
    if (values.model && values.shiftStart && values.shiftEnd && values.clockIn && values.clockOut &&
      values.breakMinutes !== undefined && values.targetHours !== undefined) {
      result = calculateOvertime({
        country: values.country ?? "de",
        model: values.model,
        shiftStart: values.shiftStart,
        shiftEnd: selectedShiftEnd,
        breakMinutes: values.breakMinutes,
        scheduledNetHours: values.weekendShift ? weekendWorkHours : undefined,
        clockIn: values.clockIn,
        clockOut: values.clockOut,
        countAfterSpecificTime: values.countAfterSpecificTime ?? false,
        thresholdTime: values.thresholdTime || "17:30",
        targetHours: selectedTargetHours,
      });
    }
  } catch { /* ignore */ }

  const isGleitzeit = values.model === "gleitzeit";
  const workRules = getWorkTimeRules(values.country ?? "de");
  const breakUsedMin = Math.round(liveBreakMs / 60000);
  const initialOvertimeMinutes = Math.round(Math.max(0, Number(initialOvertimeHours) || 0) * 60);
  const currentShiftOvertimeMinutes = result
    ? result.overtimeMinutes - result.undertimeMinutes
    : 0;
  const totalOvertimeMinutes = initialOvertimeMinutes + currentShiftOvertimeMinutes;

  const handleClockOut = (ci: string, co: string, workMs: number, breakMs: number) => {
    form.setValue("clockIn", ci);
    form.setValue("clockOut", co);
    let overtimeMin = 0;
    try {
      const r = calculateOvertime({
        country: values.country ?? "de",
        model: values.model ?? "normal",
        shiftStart: values.shiftStart ?? "09:00",
        shiftEnd: selectedShiftEnd,
        breakMinutes: values.breakMinutes ?? 30,
        scheduledNetHours: values.weekendShift ? weekendWorkHours : undefined,
        clockIn: ci, clockOut: co,
        countAfterSpecificTime: values.countAfterSpecificTime ?? false,
        thresholdTime: values.thresholdTime || "17:30",
        targetHours: selectedTargetHours,
      });
      overtimeMin = r.overtimeMinutes - (r.undertimeMinutes ?? 0);
    } catch { /* ignore */ }
    addShiftRecord({
      date: new Date().toISOString().split("T")[0],
      clockIn: ci,
      clockOut: co,
      workMs,
      breakMs,
      overtimeMin,
      weekendShift: values.weekendShift ?? false,
    });
    setHistoryKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* // Kopfbereich */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Überstundenrechner</h1>
            <p className="text-xs text-muted-foreground">Berechnung nach {workRules.shortName}</p>
          </div>
          <button
            onClick={toggle}
            aria-label="Theme wechseln"
            className="h-9 w-9 rounded-xl border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* LEFT */}
          <div className="lg:col-span-7 space-y-4">

            {/* // Schichttimer */}
            <WorkTimer
              scheduledBreakMinutes={selectedBreakMinutes}
              scheduledBreakStart={values.breakStartTime}
              shiftStart={values.shiftStart}
              shiftEnd={selectedShiftEnd}
              reminderSettings={reminderSettings}
              onReminder={(title, body) => toast({ title, description: body })}
              onStats={(wMs, bMs) => { setLiveWorkMs(wMs); setLiveBreakMs(bMs); }}
              onClockOut={handleClockOut}
            />

            {/* // Schichtfortschritt direkt unter dem Timer */}
            <ShiftProgress
              shiftStart={values.shiftStart ?? "09:00"}
              shiftEnd={selectedShiftEnd}
              scheduledBreakMin={selectedBreakMinutes}
              breakUsedMin={breakUsedMin}
              legalBreakMin={result?.legalMinimumBreak ?? 0}
            />

            {/* // Auswertung */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-border">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm font-semibold">Auswertung</p>
              </div>

              {result ? (
                <div className="p-4 space-y-3 animate-in fade-in duration-300">
                  {/* 3 stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Brutto", value: formatMinutes(result.grossMinutes) },
                      { label: "Pause", value: `${result.breakUsed} min`, warn: result.breakWarning },
                      { label: "Netto", value: formatMinutes(result.netMinutes) },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-secondary/50 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                        <p className={`font-bold tabular-nums text-sm ${s.warn ? "text-amber-500" : "text-foreground"}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Overtime */}
                  <div className="rounded-xl bg-primary/8 border border-primary/15 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary/70 font-medium mb-0.5">Überstunden</p>
                      <p className="text-3xl font-bold text-primary tabular-nums">{formatMinutes(result.overtimeMinutes)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-primary/60 mb-0.5">Dezimal</p>
                      <p className="text-xl font-bold text-primary/80 tabular-nums">{formatDecimal(result.overtimeMinutes)} h</p>
                    </div>
                  </div>
                  {values.weekendShift && (
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Als Wochenendschicht gekennzeichnet</p>
                  )}

                  {/* Undertime */}
                  {isGleitzeit && result.undertimeMinutes > 0 && (
                    <div className="rounded-xl bg-destructive/8 border border-destructive/15 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-destructive/70 font-medium mb-0.5">Minusstunden</p>
                        <p className="text-2xl font-bold text-destructive tabular-nums">{formatMinutes(result.undertimeMinutes)}</p>
                      </div>
                      <p className="text-lg font-bold text-destructive/80 tabular-nums">{formatDecimal(result.undertimeMinutes)} h</p>
                    </div>
                  )}

                  {/* Warnings / OK */}
                  {(result.breakWarning || result.maxHoursWarning) ? (
                    <div className="space-y-2">
                      {result.breakWarning && (
                        <div className="flex gap-2 items-start text-xs text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          Pause ({values.breakMinutes} min) unter gesetzlichem Minimum ({result.legalMinimumBreak} min). Minimum wird verwendet.
                        </div>
                      )}
                      {result.maxHoursWarning && (
                        <div className="flex gap-2 items-start text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-xl p-3">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                           Netto-Arbeitszeit überschreitet das Tagesmaximum von {workRules.maxDailyNetHours} h ({workRules.shortName}).
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                       Alle Vorgaben nach {workRules.shortName} sind erfüllt.
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Info className="h-5 w-5 opacity-30" />
                  <p className="text-xs">Einstellungen ausfüllen</p>
                </div>
              )}

              {/* // Bereits geleistete Überstunden und Gesamtsaldo */}
              <div className="border-t border-border p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Bisher aufgebaute Überstunden</p>
                  <p className="text-[11px] text-muted-foreground">Trage deinen aktuellen Saldo ein; er wird auf diesem Gerät gespeichert.</p>
                </div>
                <label className="flex items-center gap-3">
                  <Input
                    aria-label="Bisher aufgebaute Überstunden in Stunden"
                    type="number"
                    min={0}
                    step="0.25"
                    value={initialOvertimeHours}
                    onChange={event => setInitialOvertimeHours(event.target.value)}
                    className="max-w-36 rounded-xl"
                  />
                  <span className="text-sm text-muted-foreground">Stunden</span>
                </label>
                {result && (
                  <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
                    <div>
                      <p className="text-xs text-muted-foreground">Gesamtsaldo inkl. aktueller Auswertung</p>
                      <p className={`text-lg font-bold tabular-nums ${totalOvertimeMinutes < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatSignedMinutes(totalOvertimeMinutes)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {totalOvertimeMinutes < 0 ? "−" : ""}{formatDecimal(Math.abs(totalOvertimeMinutes))} h
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* // Urlaubplaner */}
            <VacationPanel
              now={now}
              notificationsEnabled={reminderSettings.vacation}
              reminderSettings={reminderSettings}
              onNotificationsChange={enabled => updateReminder("vacation", enabled)}
              onVacationChange={setVacation}
            />

            {/* // Feiertagskalender und Brückentage */}
            <HolidayPanel now={now} />

            {/* // Überstundenverlauf */}
            <OvertimeHistory key={historyKey} />

            {/* // Protokoll */}
            <LogPanel />
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-5 space-y-4">

              {/* // Einstellungen und Erinnerungen */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Settings className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-semibold">Einstellungen</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`} />
                </button>

                {settingsOpen && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <Form {...form}>
                      <form className="space-y-5">

                        {/* Country-specific working-time rules */}
                        <FormField control={form.control} name="country" render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Land für Arbeitszeitregeln</FormLabel>
                            <FormControl>
                              <select
                                value={field.value}
                                onChange={field.onChange}
                                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                              >
                                {Object.entries(WORK_COUNTRY_LABELS).map(([code, label]) => (
                                  <option key={code} value={code}>{label}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormDescription className="text-xs">
                              Pausenminimum und Tagesmaximum werden für dieses Land berechnet.
                            </FormDescription>
                          </FormItem>
                        )} />

                        {/* Model */}
                        <FormField control={form.control} name="model" render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Arbeitszeitmodell</FormLabel>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                                {(["normal", "gleitzeit"] as const).map(val => (
                                  <FormItem key={val} className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary p-3 rounded-xl border cursor-pointer space-y-0 transition-colors">
                                    <FormControl><RadioGroupItem value={val} /></FormControl>
                                    <FormLabel className="font-medium cursor-pointer text-sm capitalize">{val === "normal" ? "Normal" : "Gleitzeit"}</FormLabel>
                                  </FormItem>
                                ))}
                              </RadioGroup>
                            </FormControl>
                          </FormItem>
                        )} />

                        {/* Schicht */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Geplante Schicht</p>
                          {/* // Weekend shift option; the history keeps this label with the completed shift. */}
                          <FormField control={form.control} name="weekendShift" render={({ field }) => (
                            <FormItem className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-3 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div>
                                <FormLabel className="text-sm">Wochenendschicht</FormLabel>
                                <FormDescription className="text-xs mt-0.5">
                                  Eigene Netto-Sollzeit für Samstags- und Sonntagsschichten festlegen.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )} />
                          {values.weekendShift && (
                            <FormField control={form.control} name="weekendShiftHours" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Geplante Wochenend-Arbeitszeit (Netto-Stunden)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0.25}
                                    max={24}
                                    step="0.25"
                                    {...field}
                                    className="rounded-xl"
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Wird als Netto-Sollzeit für Überstunden und Fortschritt verwendet. Beginn und Pause gelten wie oben eingestellt; das Schichtende wird daraus berechnet. Wochenendzuschläge werden nicht automatisch berechnet.
                                </FormDescription>
                                <p className="text-xs text-muted-foreground">
                                  Geplantes Wochenendende: {selectedShiftEnd} Uhr
                                </p>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                          {isGleitzeit && (
                            <FormField control={form.control} name="targetHours" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Sollarbeitszeit (h)</FormLabel>
                                <FormControl><Input type="number" step="0.25" {...field} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="shiftStart" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Beginn</FormLabel>
                                <FormControl><Input type="time" {...field} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="shiftEnd" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">{values.weekendShift ? "Ende (normale Schicht)" : "Ende"}</FormLabel>
                                <FormControl><Input type="time" {...field} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="breakMinutes" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Pause (Minuten)</FormLabel>
                              <FormControl><Input type="number" {...field} className="rounded-xl" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="breakStartTime" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Pausenbeginn (optional)</FormLabel>
                              <FormControl><Input type="time" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                              <FormDescription className="text-xs">Für die Erinnerung 1 Minute vorher.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        {/* Actual times */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tatsächliche Zeiten</p>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="clockIn" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Einstempeln</FormLabel>
                                <FormControl><Input type="time" {...field} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="clockOut" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Ausstempeln</FormLabel>
                                <FormControl><Input type="time" {...field} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Bell className="h-3.5 w-3.5 text-primary" />
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Erinnerungen</p>
                          </div>
                          <div className="space-y-2">
                            {([
                              ["breakEnd", "Pausenende", "Vorlaufzeiten unten einstellbar"],
                              ["breakStart", "Pausenbeginn", "Vorlaufzeit unten einstellbar"],
                              ["shiftEnd", "Schichtende", "Vorlaufzeiten unten einstellbar"],
                            ] as const).map(([key, label, description]) => (
                              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/30 p-3">
                                <div className="flex gap-2.5">
                                  <TimerReset className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium">{label}</p>
                                    <p className="text-xs text-muted-foreground">{description}</p>
                                  </div>
                                </div>
                                <Switch checked={reminderSettings[key]} onCheckedChange={checked => updateReminder(key, checked)} aria-label={`${label} aktivieren`} />
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border bg-secondary/20 p-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">Eigene Vorlaufzeiten</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {INTERVAL_FIELDS.map(({ key, label, unit }) => (
                                <label key={key} className="space-y-1.5">
                                  <span className="text-xs text-muted-foreground">{label}</span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={reminderSettings[key]}
                                      onChange={event => updateReminderInterval(key, Number(event.target.value) || 0)}
                                      className="rounded-xl"
                                    />
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{unit}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">0 deaktiviert den jeweiligen Zeitpunkt. Beide Hinweise können unabhängig voneinander eingestellt werden.</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Jede Erinnerung wird pro Ereignis dauerhaft nur einmal ausgelöst – auch nach einem Neustart.</p>
                        </div>

                        {/* Overtime rule */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Überstundenregel</p>
                          <FormField control={form.control} name="countAfterSpecificTime" render={({ field }) => (
                            <FormItem className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-3 space-y-0">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <div>
                                <FormLabel className="text-sm">Erst ab Uhrzeit zählen</FormLabel>
                                <FormDescription className="text-xs mt-0.5">Nur Zeit nach dem Schwellenwert zählt.</FormDescription>
                              </div>
                            </FormItem>
                          )} />
                          {values.countAfterSpecificTime && (
                            <FormField control={form.control} name="thresholdTime" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Ab wann:</FormLabel>
                                <FormControl><Input type="time" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                        </div>

                      </form>
                    </Form>
                  </div>
                )}
              </div>

              {/* // Verdienst */}
              <EarningsPanel liveWorkMs={liveWorkMs} />

              {/* // FAQ: Berechnung und rechtliche Einordnung nach Arbeitsland */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">FAQ</p>
                </div>
                <div className="px-4 pb-2">
                  <Accordion type="multiple" className="w-full">
                    {[
                      { v: "timer", q: "Arbeitszeit-Timer", a: "Drücke Schicht starten wenn du anfängst, Pause einlegen für Pausen und Schicht beenden wenn du fertig bist. Zeiten und Überstunden werden automatisch gespeichert." },
                      { v: "history", q: "Überstunden-Verlauf", a: "Zeigt alle abgeschlossenen Schichten mit Datum, Arbeitszeit und Überstunden. Wochenendschichten sind markiert. Einträge werden automatisch beim Beenden gespeichert." },
                      { v: "balance", q: "Bisherige Überstunden übernehmen", a: "Gib im Bereich Auswertung deinen bereits aufgebauten Überstundenstand in Stunden ein. Der Wert wird lokal gespeichert und mit dem aktuellen Schichtsaldo zur Gesamtsumme addiert." },
                      { v: "weekend-shift", q: "Wie stelle ich meine Wochenend-Arbeitszeit ein?", a: "Aktiviere unter Einstellungen → Geplante Schicht die Wochenendschicht und trage deine Netto-Sollzeit ein. Beginn und Pausenlänge gelten wie oben eingestellt; das Wochenendende wird aus der Sollzeit und erforderlichen Pause berechnet. Die Sollzeit steuert Überstunden, Fortschritt und Schichtende-Erinnerung. Eine aktivierte Überstundenregel ab Uhrzeit gilt weiterhin. Wochenendzuschläge werden nicht automatisch berechnet." },
                      { v: "model", q: "Arbeitszeitmodell", a: "Normal: Feste Schichtzeiten, Überstunden ab Schichtende. Gleitzeit: Flexible Zeiten, Überstunden über die Sollarbeitszeit hinaus." },
                      { v: "actual", q: "Einstempeln / Ausstempeln", a: "Wann bist du wirklich gekommen und gegangen? Bei Nutzung des Timers automatisch befüllt." },
                      { v: "rule", q: "Überstundenregel", a: "Wenn Überstunden erst ab einer bestimmten Uhrzeit zählen, aktiviere diese Option." },
                      // FAQ: Explain the active country-specific calculation in plain language.
                      {
                        v: "country-rules",
                        q: "Wie wird nach meinem Land gerechnet?",
                        a: values.country === "de"
                          ? "Deutschland: Ab mehr als 6 Stunden Arbeitszeit werden mindestens 30 Minuten Pause, ab mehr als 9 Stunden 45 Minuten Pause berücksichtigt. Das Tagesmaximum liegt bei 10 Netto-Arbeitsstunden nach dem deutschen Arbeitszeitgesetz (ArbZG)."
                          : values.country === "at"
                            ? "Österreich: Ab mehr als 6 Stunden Arbeitszeit werden mindestens 30 Minuten Pause berücksichtigt. Das Tagesmaximum wird hier mit 12 Netto-Arbeitsstunden nach dem österreichischen Arbeitszeitgesetz (AZG) geprüft."
                            : "Schweiz: Ab mehr als 5,5 Stunden werden mindestens 15 Minuten, ab mehr als 7 Stunden 30 Minuten und ab mehr als 9 Stunden 60 Minuten Pause berücksichtigt. Das Tagesmaximum wird hier mit 14 Netto-Arbeitsstunden nach dem schweizerischen Arbeitsgesetz geprüft.",
                      },
                      { v: "earnings", q: "Verdienst", a: "Trage deinen Stundenlohn ein und der Verdienst wird live mit dem Timer berechnet." },
                    ].map(({ v, q, a }) => (
                      <AccordionItem key={v} value={v}>
                        <AccordionTrigger className="text-sm py-3">{q}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pb-2">
                Berechnung nach {workRules.shortName} · Tarifverträge und Sonderregelungen können abweichen · Keine Rechtsberatung
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
