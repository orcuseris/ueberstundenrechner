import { useEffect, useState } from "react";
import { Bell, BellOff, CalendarDays, ChevronDown, Plane, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  formatCountdown,
  loadVacation,
  saveVacation,
  syncNativeVacation,
  type ReminderSettings,
  type VacationPlan,
} from "@/lib/reminders";

interface Props {
  now: number;
  notificationsEnabled: boolean;
  reminderSettings: ReminderSettings;
  onNotificationsChange: (enabled: boolean) => void;
  onVacationChange?: (vacation: VacationPlan) => void;
}

export function VacationPanel({ now, notificationsEnabled, reminderSettings, onNotificationsChange, onVacationChange }: Props) {
  const [vacation, setVacation] = useState<VacationPlan>(loadVacation);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("overtime-calculator:vacation-open") !== "false";
    } catch {
      return true;
    }
  });
  const start = Date.parse(vacation.start);
  const end = Date.parse(vacation.end);
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const active = valid && now >= start && now < end;
  const remaining = active ? end - now : valid && now < start ? start - now : 0;

  const update = (next: VacationPlan) => {
    setVacation(next);
    saveVacation(next);
    syncNativeVacation(next, notificationsEnabled, reminderSettings);
    onVacationChange?.(next);
  };

  const toggleOpen = () => {
    setOpen(value => {
      const next = !value;
      try { localStorage.setItem("overtime-calculator:vacation-open", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    syncNativeVacation(vacation, notificationsEnabled, reminderSettings);
    onVacationChange?.(vacation);
  }, [notificationsEnabled, reminderSettings]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Plane className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Urlaub</p>
            <p className="text-[11px] text-muted-foreground">Countdown & Erinnerungen</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {notificationsEnabled ? <Bell className="h-4 w-4 text-emerald-500" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          <button
            type="button"
            onClick={toggleOpen}
            aria-label={open ? "Urlaubstimer zuklappen" : "Urlaubstimer öffnen"}
            className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
          >
            {open ? <X className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {open && <div className="p-4 space-y-4">
        {valid && now < end ? (
          <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-4 py-3">
            <p className="text-xs font-medium text-sky-700 dark:text-sky-300">{active ? "Urlaub läuft noch" : "Urlaub beginnt in"}</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-300 mt-1">{formatCountdown(remaining)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {active ? `bis ${new Date(end).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}` : new Date(start).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4 mb-1.5 opacity-70" />
            Plane deinen nächsten Urlaub für einen Countdown.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Beginn</span>
            <Input type="datetime-local" value={vacation.start} onChange={e => update({ ...vacation, start: e.target.value })} className="rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ende</span>
            <Input type="datetime-local" value={vacation.end} onChange={e => update({ ...vacation, end: e.target.value })} className="rounded-xl" />
          </label>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border bg-secondary/30 p-3">
          <div className="flex gap-2.5">
            <ShieldCheck className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Urlaubs-Erinnerungen</p>
              <p className="text-xs text-muted-foreground mt-0.5">7 Tage und 1 Tag vor Beginn und Ende</p>
            </div>
          </div>
          <Switch checked={notificationsEnabled} onCheckedChange={onNotificationsChange} aria-label="Urlaubs-Erinnerungen aktivieren" />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Android-Benachrichtigungen werden von der App automatisch geplant. Bitte erlaube Benachrichtigungen in den Android-Systemeinstellungen.
        </p>
      </div>}
    </div>
  );
}