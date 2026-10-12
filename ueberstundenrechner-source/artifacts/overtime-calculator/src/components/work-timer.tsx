import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Coffee, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { addLog } from "@/lib/logs";
import {
  markReminderSent,
  sendBrowserNotification,
  syncNativeBreak,
  syncNativeShiftEnd,
  type ReminderSettings,
} from "@/lib/reminders";

interface TimerState {
  startedAt: number | null;
  accumulatedMs: number;
  running: boolean;
  onBreak: boolean;
  breakStartedAt: number | null;
  totalBreakMs: number;
}

const KEY = "overtime-calculator:work-timer";

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { startedAt: null, accumulatedMs: 0, running: false, onBreak: false, breakStartedAt: null, totalBreakMs: 0 };
    return JSON.parse(raw) as TimerState;
  } catch {
    return { startedAt: null, accumulatedMs: 0, running: false, onBreak: false, breakStartedAt: null, totalBreakMs: 0 };
  }
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(n => n.toString().padStart(2, "0")).join(":");
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface Props {
  scheduledBreakMinutes?: number;
  scheduledBreakStart?: string;
  shiftStart?: string;
  shiftEnd?: string;
  reminderSettings?: ReminderSettings;
  onReminder?: (title: string, body: string) => void;
  onStats?: (workMs: number, breakMs: number) => void;
  onClockOut?: (clockIn: string, clockOut: string, workMs: number, breakMs: number) => void;
}

export function WorkTimer({
  scheduledBreakMinutes = 0,
  scheduledBreakStart,
  shiftStart = "09:00",
  shiftEnd = "17:30",
  reminderSettings,
  onReminder,
  onStats,
  onClockOut,
}: Props) {
  const [state, setState] = useState<TimerState>(load);
  const [now, setNow] = useState(Date.now);
  const [endShiftDialogOpen, setEndShiftDialogOpen] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  const notify = (id: string, title: string, body: string) => {
    if (!markReminderSent(id)) return;
    sendBrowserNotification(title, body);
    onReminder?.(title, body);
  };

  const todayAt = (time: string, base: number) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(base);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.getTime();
  };

  useEffect(() => {
    if (!reminderSettings) return;
    const current = new Date(now);
    const dateKey = current.toISOString().slice(0, 10);

    if (state.running && reminderSettings.shiftEnd && state.startedAt) {
      const shiftEndAt = todayAt(shiftEnd, state.startedAt);
      const shiftStartAt = todayAt(shiftStart, state.startedAt);
      const endAt = shiftEndAt <= shiftStartAt ? shiftEndAt + 86400000 : shiftEndAt;
      for (const lead of [reminderSettings.shiftEndFirstMinutes, reminderSettings.shiftEndSecondMinutes]) {
        if (lead <= 0) continue;
        if (now >= endAt - lead * 60000 && now < endAt) {
          notify(`shift-end-${lead}m-${dateKey}-${endAt}`, `Schicht endet in ${lead} Minuten`, `Deine geplante Schicht endet um ${new Date(endAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}.`);
        }
      }
    }

    if (state.running && !state.onBreak && reminderSettings.breakStart && scheduledBreakStart) {
      const breakStartAt = todayAt(scheduledBreakStart, now);
      const lead = reminderSettings.breakStartMinutes;
      if (lead > 0 && now >= breakStartAt - lead * 60000 && now < breakStartAt) {
        notify(`break-start-${lead}m-${dateKey}-${scheduledBreakStart}`, `Pause beginnt in ${lead} Minute${lead === 1 ? "" : "n"}`, `Deine geplante Pause beginnt um ${scheduledBreakStart} Uhr.`);
      }
    }

    if (state.onBreak && state.breakStartedAt && scheduledBreakMinutes > 0 && reminderSettings.breakEnd) {
      const breakEndAt = state.breakStartedAt + scheduledBreakMinutes * 60000;
      for (const lead of [reminderSettings.breakEndFirstSeconds, reminderSettings.breakEndSecondSeconds]) {
        if (lead <= 0) continue;
        if (now >= breakEndAt - lead * 1000 && now < breakEndAt) {
          notify(`break-end-${lead}s-${state.breakStartedAt}`, `Pause endet in ${lead} Sekunden`, "Deine geplante Pausenzeit ist fast vorbei.");
        }
      }
    }
  }, [now, reminderSettings, state.running, state.onBreak, state.startedAt, state.breakStartedAt, scheduledBreakMinutes, scheduledBreakStart, shiftStart, shiftEnd]);

  useEffect(() => {
    if (!reminderSettings) return;
    if (state.running && state.startedAt) {
      const shiftEndAt = todayAt(shiftEnd, state.startedAt);
      const shiftStartAt = todayAt(shiftStart, state.startedAt);
      const endAt = shiftEndAt <= shiftStartAt ? shiftEndAt + 86400000 : shiftEndAt;
      syncNativeShiftEnd(endAt, reminderSettings.shiftEnd, reminderSettings);
    } else {
      syncNativeShiftEnd(0, false, reminderSettings);
    }

    const breakStartAt = state.startedAt && scheduledBreakStart
      ? todayAt(scheduledBreakStart, state.startedAt)
      : 0;
    const breakEndAt = state.onBreak && state.breakStartedAt && scheduledBreakMinutes > 0
      ? state.breakStartedAt + scheduledBreakMinutes * 60000
      : 0;
    syncNativeBreak(breakEndAt, breakStartAt, reminderSettings.breakEnd, reminderSettings.breakStart && !!breakStartAt, reminderSettings);
  }, [reminderSettings, state.running, state.onBreak, state.startedAt, state.breakStartedAt, scheduledBreakMinutes, scheduledBreakStart, shiftStart, shiftEnd]);

  const grossMs = state.accumulatedMs + (state.running && state.startedAt ? now - state.startedAt : 0);
  const liveBreakExtra = state.onBreak && state.breakStartedAt ? now - state.breakStartedAt : 0;
  const totalBreakMs = state.totalBreakMs + liveBreakExtra;
  const workMs = Math.max(0, grossMs - totalBreakMs);

  useEffect(() => { onStats?.(workMs, totalBreakMs); });

  const scheduledBreakMs = scheduledBreakMinutes * 60 * 1000;
  const remainingBreakMs = Math.max(0, scheduledBreakMs - totalBreakMs);
  const breakOverMs = totalBreakMs > scheduledBreakMs ? totalBreakMs - scheduledBreakMs : 0;

  const start = () => {
    const t = Date.now();
    setState(p => ({ ...p, startedAt: t, running: true }));
    addLog("clock_in", `Einstempeln um ${fmtTime(t)}`);
  };

  const pause = () => {
    setState(p => {
      if (!p.running || !p.startedAt) return p;
      return { ...p, accumulatedMs: p.accumulatedMs + (Date.now() - p.startedAt), startedAt: null, running: false };
    });
  };

  const resume = () => setState(p => ({ ...p, startedAt: Date.now(), running: true }));

  const startBreak = () => {
    const t = Date.now();
    setState(p => ({ ...p, onBreak: true, breakStartedAt: t }));
    addLog("break_start", `Pause begonnen um ${fmtTime(t)}`);
  };

  const endBreak = () => {
    const t = Date.now();
    setState(p => {
      const extra = p.breakStartedAt ? t - p.breakStartedAt : 0;
      addLog("break_end", `Pause beendet um ${fmtTime(t)}`, Math.round(extra / 60000));
      return { ...p, onBreak: false, breakStartedAt: null, totalBreakMs: p.totalBreakMs + extra };
    });
  };

  const reset = () => setState({ startedAt: null, accumulatedMs: 0, running: false, onBreak: false, breakStartedAt: null, totalBreakMs: 0 });

  const finishShift = () => {
    const t = Date.now();
    const clockOut = new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const clockIn = state.startedAt
      ? new Date(state.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      : clockOut;
    addLog("clock_out", `Schicht beendet um ${fmtTime(t)}`);
    onClockOut?.(clockIn, clockOut, workMs, totalBreakMs);
    reset();
  };

  const endShift = () => setEndShiftDialogOpen(true);

  const idle = !state.running && grossMs === 0;

  const statusLabel = state.onBreak
    ? "Pause läuft"
    : state.running
    ? `seit ${state.startedAt ? fmtTime(state.startedAt) : "—"}`
    : grossMs > 0 ? "Gestoppt" : "Bereit";

  const statusColor = state.onBreak
    ? "bg-amber-500"
    : state.running
    ? "bg-emerald-500"
    : "bg-muted-foreground/30";

  return (
    <>
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
      {/* Hero timer display */}
      <div className="px-4 pt-5 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Work timer */}
          <div className="rounded-xl bg-white/5 px-3 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className={`h-1.5 w-1.5 rounded-full ${state.running && !state.onBreak ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Arbeitszeit</span>
            </div>
            <p className="font-mono font-bold tabular-nums leading-none text-white"
              style={{ fontSize: "clamp(2rem, 7vw, 3.5rem)" }}>
              {fmt(workMs)}
            </p>
            <p className="text-xs text-slate-500 mt-1.5">{statusLabel}</p>
          </div>

          {/* Break timer */}
          <div className={`rounded-xl px-3 py-4 text-center ${state.onBreak ? "bg-amber-500/15" : "bg-white/5"}`}>
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className={`h-1.5 w-1.5 rounded-full ${state.onBreak ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Pause</span>
            </div>
            <p className={`font-mono font-bold tabular-nums leading-none ${state.onBreak ? "text-amber-400" : "text-slate-400"}`}
              style={{ fontSize: "clamp(2rem, 7vw, 3.5rem)" }}>
              {fmt(totalBreakMs)}
            </p>
            <p className={`text-xs mt-1.5 ${breakOverMs > 0 ? "text-red-400" : "text-slate-500"}`}>
              {scheduledBreakMinutes > 0
                ? breakOverMs > 0
                  ? `+${fmt(breakOverMs)} über Plan`
                  : `${fmt(remainingBreakMs)} verbl.`
                : state.onBreak ? "läuft…" : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {idle && (
          <button
            type="button"
            onClick={start}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <Play className="h-4 w-4" />Schicht starten
          </button>
        )}
        {state.running && !state.onBreak && (
          <>
            <button
              type="button"
              onClick={startBreak}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              <Coffee className="h-4 w-4" />Pause einlegen
            </button>
            <button
              type="button"
              onClick={pause}
              className="flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-3 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          </>
        )}
        {state.onBreak && (
          <button
            type="button"
            onClick={endBreak}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <Play className="h-4 w-4" />Pause beenden
          </button>
        )}
        {!state.running && !state.onBreak && grossMs > 0 && (
          <button
            type="button"
            onClick={resume}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <Play className="h-4 w-4" />Fortsetzen
          </button>
        )}
        {(state.running || (!state.onBreak && grossMs > 0)) && (
          <button
            type="button"
            onClick={endShift}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />Schicht beenden
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={state.running || state.onBreak || grossMs === 0}
          className="flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
    <AlertDialog open={endShiftDialogOpen} onOpenChange={setEndShiftDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Schicht wirklich beenden?</AlertDialogTitle>
          <AlertDialogDescription>
            Die aktuelle Arbeitszeit wird gespeichert und der Timer wird zurückgesetzt. Dieser Vorgang kann nicht automatisch rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={finishShift}>Schicht beenden</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
