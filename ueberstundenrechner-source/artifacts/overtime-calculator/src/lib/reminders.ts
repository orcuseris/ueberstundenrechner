export interface ReminderSettings {
  vacation: boolean;
  breakEnd: boolean;
  breakStart: boolean;
  shiftEnd: boolean;
  vacationStartFirstDays: number;
  vacationStartSecondDays: number;
  vacationEndFirstDays: number;
  vacationEndSecondDays: number;
  breakEndFirstSeconds: number;
  breakEndSecondSeconds: number;
  breakStartMinutes: number;
  shiftEndFirstMinutes: number;
  shiftEndSecondMinutes: number;
}

export interface VacationPlan {
  start: string;
  end: string;
}

declare global {
  interface Window {
    AndroidReminders?: {
      setVacation: (start: number, end: number, enabled: boolean, startFirstDays: number, startSecondDays: number, endFirstDays: number, endSecondDays: number) => void;
      setShiftEnd: (end: number, enabled: boolean, firstMinutes: number, secondMinutes: number) => void;
      setBreak: (end: number, start: number, endEnabled: boolean, startEnabled: boolean, firstSeconds: number, secondSeconds: number, startMinutes: number) => void;
    };
  }
}

const SETTINGS_KEY = "overtime-calculator:reminder-settings";
const VACATION_KEY = "overtime-calculator:vacation";
const SENT_KEY = "overtime-calculator:sent-reminders";

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  vacation: true,
  breakEnd: true,
  breakStart: false,
  shiftEnd: true,
  vacationStartFirstDays: 7,
  vacationStartSecondDays: 1,
  vacationEndFirstDays: 7,
  vacationEndSecondDays: 1,
  breakEndFirstSeconds: 30,
  breakEndSecondSeconds: 10,
  breakStartMinutes: 1,
  shiftEndFirstMinutes: 30,
  shiftEndSecondMinutes: 5,
};

export function loadReminderSettings(): ReminderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<ReminderSettings>;
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      ...saved,
      ...Object.fromEntries(
        Object.keys(DEFAULT_REMINDER_SETTINGS)
          .filter(key => key !== "vacation" && key !== "breakEnd" && key !== "breakStart" && key !== "shiftEnd")
          .map(key => [key, Math.max(0, Number(saved[key as keyof ReminderSettings] ?? DEFAULT_REMINDER_SETTINGS[key as keyof ReminderSettings]))]),
      ),
    } as ReminderSettings;
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadVacation(): VacationPlan {
  try {
    return JSON.parse(localStorage.getItem(VACATION_KEY) ?? '{"start":"","end":""}') as VacationPlan;
  } catch {
    return { start: "", end: "" };
  }
}

export function saveVacation(vacation: VacationPlan) {
  localStorage.setItem(VACATION_KEY, JSON.stringify(vacation));
}

export function syncNativeVacation(vacation: VacationPlan, enabled: boolean, settings: ReminderSettings) {
  const start = Date.parse(vacation.start);
  const end = Date.parse(vacation.end);
  window.AndroidReminders?.setVacation(
    Number.isFinite(start) ? start : 0,
    Number.isFinite(end) ? end : 0,
    enabled,
    settings.vacationStartFirstDays,
    settings.vacationStartSecondDays,
    settings.vacationEndFirstDays,
    settings.vacationEndSecondDays,
  );
}

export function syncNativeShiftEnd(end: number, enabled: boolean, settings: ReminderSettings) {
  window.AndroidReminders?.setShiftEnd(end, enabled, settings.shiftEndFirstMinutes, settings.shiftEndSecondMinutes);
}

export function syncNativeBreak(end: number, start: number, endEnabled: boolean, startEnabled: boolean, settings: ReminderSettings) {
  window.AndroidReminders?.setBreak(
    end,
    start,
    endEnabled,
    startEnabled,
    settings.breakEndFirstSeconds,
    settings.breakEndSecondSeconds,
    settings.breakStartMinutes,
  );
}

function getSentReminders(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function markReminderSent(id: string): boolean {
  const sent = getSentReminders();
  if (sent[id]) return false;
  sent[id] = Date.now();
  const entries = Object.entries(sent).sort(([, a], [, b]) => b - a).slice(0, 250);
  localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(entries)));
  return true;
}

export function sendBrowserNotification(title: string, body: string) {
  if (window.AndroidReminders) return;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.svg", tag: `overtime-${title}` });
  }
}

export function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days} T ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function vacationState(vacation: VacationPlan, now = Date.now()) {
  const start = Date.parse(vacation.start);
  const end = Date.parse(vacation.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { kind: "none" as const };
  if (now < start) return { kind: "planned" as const, ms: start - now, start, end };
  if (now < end) return { kind: "active" as const, ms: end - now, start, end };
  return { kind: "ended" as const, ms: 0, start, end };
}

export interface DueReminder {
  id: string;
  title: string;
  body: string;
}

export function dueVacationReminders(vacation: VacationPlan, settings: ReminderSettings, now = Date.now()): DueReminder[] {
  const start = Date.parse(vacation.start);
  const end = Date.parse(vacation.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const daysLabel = (days: number) => days === 1 ? "morgen" : `in ${days} Tagen`;
  const reminders = [
    { key: "start-first", days: settings.vacationStartFirstDays, at: start, title: `Urlaub ${daysLabel(settings.vacationStartFirstDays)}`, body: `Dein geplanter Urlaub beginnt ${daysLabel(settings.vacationStartFirstDays)}.` },
    { key: "start-second", days: settings.vacationStartSecondDays, at: start, title: `Urlaub ${daysLabel(settings.vacationStartSecondDays)}`, body: `Dein geplanter Urlaub beginnt ${daysLabel(settings.vacationStartSecondDays)}.` },
    { key: "end-first", days: settings.vacationEndFirstDays, at: end, title: `Urlaubsende ${daysLabel(settings.vacationEndFirstDays)}`, body: `Dein Urlaub endet ${daysLabel(settings.vacationEndFirstDays)}.` },
    { key: "end-second", days: settings.vacationEndSecondDays, at: end, title: `Urlaubsende ${daysLabel(settings.vacationEndSecondDays)}`, body: `Dein Urlaub endet ${daysLabel(settings.vacationEndSecondDays)}.` },
  ].map(item => ({
    ...item,
    id: `vacation-${item.key}-${item.days}-${start}-${end}`,
    at: item.at - item.days * 86400000,
  }));
  return reminders.filter(item => item.days > 0 && now >= item.at && now < (item.key.includes("start") ? start : end));
}