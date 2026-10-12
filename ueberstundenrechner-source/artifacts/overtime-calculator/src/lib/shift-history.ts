export interface ShiftRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  workMs: number;
  breakMs: number;
  overtimeMin: number;
  weekendShift?: boolean;
}

const KEY = "overtime-calculator:shift-history";

export function getShiftHistory(): ShiftRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ShiftRecord[]; }
  catch { return []; }
}

export function addShiftRecord(record: Omit<ShiftRecord, "id">): void {
  const history = getShiftHistory();
  history.push({ ...record, id: `${Date.now()}-${Math.random()}` });
  localStorage.setItem(KEY, JSON.stringify(history.slice(-90)));
}

export function clearShiftHistory(): void {
  localStorage.removeItem(KEY);
}
