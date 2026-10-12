import { useState } from "react";
import { CalendarDays, ChevronDown, MapPin, X } from "lucide-react";
import { formatCountdown } from "@/lib/reminders";
import {
  COUNTRY_LABELS,
  formatHolidayDate,
  formatHolidayShortDate,
  getHolidays,
  getNextHoliday,
  getRegion,
  HOLIDAY_REGIONS,
  isWeekend,
  type HolidayCountry,
} from "@/lib/holiday-calendar";

const HOLIDAY_SELECTION_KEY = "overtime-calculator:holiday-selection";
const HOLIDAY_PANEL_OPEN_KEY = "overtime-calculator:holiday-panel-open";

function loadSelection(): { country: HolidayCountry; region: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(HOLIDAY_SELECTION_KEY) ?? "{}") as { country?: HolidayCountry; region?: string };
    const country = saved.country && COUNTRY_LABELS[saved.country] ? saved.country : "de";
    return { country, region: getRegion(country, saved.region ?? "").code };
  } catch {
    return { country: "de", region: "BE" };
  }
}

interface Props {
  now: number;
}

export function HolidayPanel({ now }: Props) {
  const [selection, setSelection] = useState(loadSelection);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(HOLIDAY_PANEL_OPEN_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const regionOptions = HOLIDAY_REGIONS.filter(region => region.country === selection.country);
  const currentDate = new Date(now);
  const currentYear = currentDate.getFullYear();
  const today = new Date(currentYear, currentDate.getMonth(), currentDate.getDate());
  const nextHoliday = getNextHoliday(selection.country, selection.region, currentDate);
  const upcoming = getHolidays(selection.country, selection.region, currentYear)
    .filter(holiday => holiday.date.getTime() >= today.getTime())
    .slice(0, 5);

  const updateSelection = (country: HolidayCountry, region: string) => {
    const next = { country, region };
    setSelection(next);
    localStorage.setItem(HOLIDAY_SELECTION_KEY, JSON.stringify(next));
  };

  // Keep the holiday planner collapsed state across app restarts.
  const toggleOpen = () => {
    setOpen(value => {
      const next = !value;
      try { localStorage.setItem(HOLIDAY_PANEL_OPEN_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Feiertagskalender */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Feiertage & Brückentage</p>
            <p className="text-[11px] text-muted-foreground">Feiertags-Countdown nach Region</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={open ? "Feiertage und Brückentage zuklappen" : "Feiertage und Brückentage öffnen"}
          className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
        >
          {open ? <X className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      {open && <div className="p-4 space-y-4">
        {/* Country and region selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Land</span>
            <select
              value={selection.country}
              onChange={event => {
                const country = event.target.value as HolidayCountry;
                updateSelection(country, getRegion(country, "").code);
              }}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(COUNTRY_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{selection.country === "ch" ? "Kanton" : "Bundesland"}</span>
            <select
              value={selection.region}
              onChange={event => updateSelection(selection.country, event.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {regionOptions.map(region => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </label>
        </div>

        {nextHoliday ? (
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Nächster Feiertag</p>
                <p className="text-lg font-bold mt-1">{nextHoliday.name}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{formatHolidayDate(nextHoliday.date)}</p>
              </div>
              <MapPin className="h-4 w-4 text-violet-500 mt-1" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-300 mt-3">{formatCountdown(nextHoliday.date.getTime() - now)}</p>
            <p className="text-xs mt-1 text-muted-foreground">
              {isWeekend(nextHoliday.date) ? "Fällt auf ein Wochenende." : "Fällt auf einen Werktag."}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">Keine Feiertage gefunden.</p>
        )}

        <details className="rounded-xl border bg-secondary/20">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-medium">
            Feiertage dieses Jahres anzeigen
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <div className="border-t border-border px-3 pb-2">
            {upcoming.map(holiday => (
              <div key={`${holiday.name}-${holiday.date.toISOString()}`} className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                <span className="text-xs">{holiday.name}</span>
                <span className={`text-[11px] ${isWeekend(holiday.date) ? "text-amber-600" : "text-muted-foreground"}`}>
                  {formatHolidayShortDate(holiday.date)}{isWeekend(holiday.date) ? " · Wochenende" : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>}
    </div>
  );
}