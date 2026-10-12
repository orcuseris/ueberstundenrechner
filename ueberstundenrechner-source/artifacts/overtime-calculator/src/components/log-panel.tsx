import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, Trash2, RefreshCw } from "lucide-react";
import { getLogs, clearLogs, formatLogTime, type LogEntry } from "@/lib/logs";

const TYPE_STYLES: Record<string, string> = {
  clock_in: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  break_start: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  break_end: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  clock_out: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  overtime: "bg-primary/15 text-primary",
};

const TYPE_LABELS: Record<string, string> = {
  clock_in: "Einstempeln",
  break_start: "Pause Start",
  break_end: "Pause Ende",
  clock_out: "Ausstempeln",
  overtime: "Überstunden",
};

export function LogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs().reverse());
  const refresh = useCallback(() => setLogs(getLogs().reverse()), []);
  const handleClear = () => { clearLogs(); setLogs([]); };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Protokoll</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={refresh} className="h-7 w-7 p-0 rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={logs.length === 0} className="h-7 w-7 p-0 rounded-lg">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-5">
          Noch keine Einträge. Timer starten.
        </p>
      ) : (
        <ScrollArea className="h-48">
          <div className="space-y-1 pr-2">
            {logs.map(entry => (
              <div key={entry.id} className="flex items-center gap-2.5 text-xs py-1.5 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground tabular-nums w-9 shrink-0">{formatLogTime(entry.ts)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_STYLES[entry.type] ?? ""}`}>
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </span>
                <span className="text-muted-foreground truncate">{entry.label}</span>
                {entry.durationMin !== undefined && (
                  <span className="ml-auto text-muted-foreground shrink-0">{entry.durationMin} min</span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
