import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Trash2, RefreshCw } from "lucide-react";
import { getShiftHistory, clearShiftHistory, type ShiftRecord } from "@/lib/shift-history";

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function groupByDate(records: ShiftRecord[]) {
  const map = new Map<string, ShiftRecord[]>();
  for (const r of records) {
    const list = map.get(r.date) ?? [];
    list.push(r);
    map.set(r.date, list);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function OvertimeHistory() {
  const [records, setRecords] = useState<ShiftRecord[]>(() => getShiftHistory());
  const refresh = useCallback(() => setRecords(getShiftHistory()), []);
  const handleClear = () => { clearShiftHistory(); setRecords([]); };

  const groups = groupByDate(records);
  const totalMin = records.reduce((s, r) => s + r.overtimeMin, 0);
  const totalH = Math.floor(Math.abs(totalMin) / 60);
  const totalM = Math.abs(totalMin) % 60;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Überstunden-Verlauf</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={refresh} className="h-7 w-7 p-0 rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={records.length === 0} className="h-7 w-7 p-0 rounded-lg">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {records.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/60">
          <div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
            <p className={`text-lg font-bold tabular-nums ${totalMin >= 0 ? "text-primary" : "text-destructive"}`}>
              {totalMin >= 0 ? "+" : "-"}{totalH}h {totalM}m
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Schichten</p>
            <p className="text-lg font-bold text-foreground">{records.length}</p>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-5">
          Noch keine Schichten. Beende deine erste Schicht.
        </p>
      ) : (
        <ScrollArea className="h-56">
          <div className="space-y-3 pr-2">
            {groups.map(([date, shifts]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{fmtDate(date)}</p>
                <div className="space-y-1.5">
                  {shifts.map(r => {
                    const oH = Math.floor(Math.abs(r.overtimeMin) / 60), oM = Math.abs(r.overtimeMin) % 60;
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-xs">
                        <span className="text-muted-foreground tabular-nums">{r.clockIn}–{r.clockOut}</span>
                        <span className="text-muted-foreground">{fmtMs(r.workMs)}</span>
                        {r.weekendShift && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Wochenende</span>}
                        <span className={`ml-auto font-bold tabular-nums shrink-0 ${r.overtimeMin > 0 ? "text-primary" : r.overtimeMin < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {r.overtimeMin > 0 ? "+" : r.overtimeMin < 0 ? "-" : ""}{oH}h {oM}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
