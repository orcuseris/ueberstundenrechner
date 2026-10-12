import { useEffect, useState } from "react";

interface Props {
  shiftStart: string;
  shiftEnd: string;
  scheduledBreakMin: number;
  breakUsedMin: number;
  legalBreakMin: number;
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function ShiftProgress({ shiftStart, shiftEnd, scheduledBreakMin, breakUsedMin, legalBreakMin }: Props) {
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 60000);
    return () => clearInterval(id);
  }, []);

  const startMin = timeToMin(shiftStart);
  let endMin = timeToMin(shiftEnd);
  if (endMin <= startMin) endMin += 24 * 60;
  const totalShiftMin = endMin - startMin;

  const elapsed = Math.min(Math.max(0, now - startMin), totalShiftMin);
  const shiftPct = totalShiftMin > 0 ? Math.round((elapsed / totalShiftMin) * 100) : 0;

  const effectiveBreak = Math.max(scheduledBreakMin, legalBreakMin);
  const breakPct = effectiveBreak > 0 ? Math.min(100, Math.round((breakUsedMin / effectiveBreak) * 100)) : 0;
  const breakOver = breakUsedMin > effectiveBreak;

  const remaining = Math.max(0, totalShiftMin - elapsed);
  const remH = Math.floor(remaining / 60), remM = remaining % 60;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fortschritt</p>

      {/* Shift bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">{shiftStart}</span>
          <span className="font-medium text-foreground">
            {shiftPct >= 100 ? "✓ Schicht beendet" : shiftPct === 0 ? "Noch nicht begonnen" : `${shiftPct}% — noch ${remH}h ${remM}m`}
          </span>
          <span className="text-muted-foreground">{shiftEnd}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${shiftPct}%` }}
          />
        </div>
      </div>

      {/* Break bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Pause</span>
          <span className={`font-medium ${breakOver ? "text-destructive" : "text-foreground"}`}>
            {breakUsedMin} / {effectiveBreak} min{breakOver && " (überzogen)"}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${breakOver ? "bg-destructive" : "bg-amber-500"}`}
            style={{ width: `${breakPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
