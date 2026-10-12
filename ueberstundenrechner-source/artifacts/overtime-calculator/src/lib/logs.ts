export type LogType = "clock_in" | "break_start" | "break_end" | "clock_out" | "overtime";

export interface LogEntry {
  id: string;
  ts: number;
  type: LogType;
  label: string;
  durationMin?: number;
}

const KEY = "overtime-calculator:logs";

export function getLogs(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LogEntry[];
  } catch {
    return [];
  }
}

export function addLog(type: LogType, label: string, durationMin?: number) {
  const logs = getLogs();
  logs.push({ id: `${Date.now()}-${Math.random()}`, ts: Date.now(), type, label, durationMin });
  localStorage.setItem(KEY, JSON.stringify(logs.slice(-100)));
}

export function clearLogs() {
  localStorage.removeItem(KEY);
}

export function formatLogTime(ts: number) {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
