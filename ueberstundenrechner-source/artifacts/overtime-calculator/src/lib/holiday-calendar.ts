// Feiertagskalender: lokale Berechnung für Deutschland, Österreich und die Schweiz.

export type HolidayCountry = "de" | "at" | "ch";

export interface HolidayRegion {
  country: HolidayCountry;
  code: string;
  name: string;
}

export interface Holiday {
  date: Date;
  name: string;
}

export interface VacationRecommendation {
  holiday: Holiday;
  vacationDates: Date[];
  freeDays: number;
  explanation: string;
}

export const COUNTRY_LABELS: Record<HolidayCountry, string> = {
  de: "Deutschland",
  at: "Österreich",
  ch: "Schweiz",
};

export const HOLIDAY_REGIONS: HolidayRegion[] = [
  // Deutschland: alle 16 Bundesländer.
  ...[
    ["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"], ["BB", "Brandenburg"],
    ["HB", "Bremen"], ["HH", "Hamburg"], ["HE", "Hessen"], ["MV", "Mecklenburg-Vorpommern"],
    ["NI", "Niedersachsen"], ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"],
    ["SL", "Saarland"], ["SN", "Sachsen"], ["ST", "Sachsen-Anhalt"],
    ["SH", "Schleswig-Holstein"], ["TH", "Thüringen"],
  ].map(([code, name]) => ({ country: "de" as const, code, name })),
  // Österreich: alle neun Bundesländer.
  ...[
    ["B", "Burgenland"], ["K", "Kärnten"], ["NÖ", "Niederösterreich"], ["OÖ", "Oberösterreich"],
    ["S", "Salzburg"], ["ST", "Steiermark"], ["T", "Tirol"], ["V", "Vorarlberg"], ["W", "Wien"],
  ].map(([code, name]) => ({ country: "at" as const, code, name })),
  // Schweiz: alle 26 Kantone.
  ...[
    ["AG", "Aargau"], ["AI", "Appenzell Innerrhoden"], ["AR", "Appenzell Ausserrhoden"],
    ["BE", "Bern"], ["BL", "Basel-Landschaft"], ["BS", "Basel-Stadt"], ["FR", "Freiburg"],
    ["GE", "Genf"], ["GL", "Glarus"], ["GR", "Graubünden"], ["JU", "Jura"], ["LU", "Luzern"],
    ["NE", "Neuenburg"], ["NW", "Nidwalden"], ["OW", "Obwalden"], ["SG", "St. Gallen"],
    ["SH", "Schaffhausen"], ["SO", "Solothurn"], ["SZ", "Schwyz"], ["TG", "Thurgau"],
    ["TI", "Tessin"], ["UR", "Uri"], ["VD", "Waadt"], ["VS", "Wallis"], ["ZG", "Zug"], ["ZH", "Zürich"],
  ].map(([code, name]) => ({ country: "ch" as const, code, name })),
];

const dayMs = 86400000;

function dateAtNoon(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateAtNoon(year, month, day);
}

function holiday(date: Date, name: string): Holiday {
  return { date, name };
}

function addCommonGermanHolidays(year: number, region: string): Holiday[] {
  const easter = easterSunday(year);
  const holidays = [
    holiday(dateAtNoon(year, 1, 1), "Neujahr"),
    holiday(addDays(easter, -2), "Karfreitag"),
    holiday(addDays(easter, 1), "Ostermontag"),
    holiday(dateAtNoon(year, 5, 1), "Tag der Arbeit"),
    holiday(addDays(easter, 39), "Christi Himmelfahrt"),
    holiday(addDays(easter, 50), "Pfingstmontag"),
    holiday(dateAtNoon(year, 10, 3), "Tag der Deutschen Einheit"),
    holiday(dateAtNoon(year, 12, 25), "1. Weihnachtstag"),
    holiday(dateAtNoon(year, 12, 26), "2. Weihnachtstag"),
  ];

  if (["BW", "BY", "ST"].includes(region)) holidays.push(holiday(dateAtNoon(year, 1, 6), "Heilige Drei Könige"));
  if (["BE", "MV"].includes(region)) holidays.push(holiday(dateAtNoon(year, 3, 8), "Internationaler Frauentag"));
  if (["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"].includes(region)) {
    holidays.push(holiday(dateAtNoon(year, 10, 31), "Reformationstag"));
  }
  if (["BW", "BY", "NW", "RP", "SL"].includes(region)) holidays.push(holiday(addDays(easter, 60), "Fronleichnam"));
  if (["BW", "BY", "NW", "RP", "SL"].includes(region)) holidays.push(holiday(dateAtNoon(year, 11, 1), "Allerheiligen"));
  if (["BY", "SL"].includes(region)) holidays.push(holiday(dateAtNoon(year, 8, 15), "Mariä Himmelfahrt"));
  if (region === "SN") {
    const nov23 = dateAtNoon(year, 11, 23);
    const daysBack = (nov23.getDay() + 6) % 7;
    holidays.push(holiday(addDays(nov23, -(daysBack + 4)), "Buß- und Bettag"));
  }
  if (region === "TH") holidays.push(holiday(dateAtNoon(year, 9, 20), "Weltkindertag"));
  return holidays;
}

function addAustrianHolidays(year: number, region: string): Holiday[] {
  const easter = easterSunday(year);
  const holidays = [
    holiday(dateAtNoon(year, 1, 1), "Neujahr"),
    holiday(dateAtNoon(year, 1, 6), "Heilige Drei Könige"),
    holiday(addDays(easter, 1), "Ostermontag"),
    holiday(dateAtNoon(year, 5, 1), "Staatsfeiertag"),
    holiday(addDays(easter, 39), "Christi Himmelfahrt"),
    holiday(addDays(easter, 50), "Pfingstmontag"),
    holiday(addDays(easter, 60), "Fronleichnam"),
    holiday(dateAtNoon(year, 8, 15), "Mariä Himmelfahrt"),
    holiday(dateAtNoon(year, 10, 26), "Nationalfeiertag"),
    holiday(dateAtNoon(year, 11, 1), "Allerheiligen"),
    holiday(dateAtNoon(year, 12, 8), "Mariä Empfängnis"),
    holiday(dateAtNoon(year, 12, 25), "Christtag"),
    holiday(dateAtNoon(year, 12, 26), "Stefanitag"),
  ];
  if (["K", "ST", "T", "V"].includes(region)) holidays.push(holiday(dateAtNoon(year, 3, 19), "Josefitag"));
  if (region === "OÖ") holidays.push(holiday(dateAtNoon(year, 5, 4), "Florianitag"));
  if (region === "S") holidays.push(holiday(dateAtNoon(year, 9, 24), "Rupertitag"));
  if (region === "B") holidays.push(holiday(dateAtNoon(year, 11, 11), "Martinstag"));
  if (["NÖ", "W"].includes(region)) holidays.push(holiday(dateAtNoon(year, 11, 15), "Leopolditag"));
  return holidays;
}

const SWISS_EXTRA_HOLIDAYS: Record<string, Array<[number, number, string]>> = {
  AG: [[1, 2, "Berchtoldstag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  AI: [[1, 2, "Berchtoldstag"], [3, 19, "Josefitag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"], [12, 8, "Mariä Empfängnis"]],
  AR: [[1, 2, "Berchtoldstag"], [8, 1, "Bundesfeier"], [11, 1, "Allerheiligen"]],
  BE: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [12, 26, "Stephanstag"]],
  BL: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
  BS: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
  FR: [[5, 1, "Tag der Arbeit"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"], [12, 8, "Mariä Empfängnis"]],
  GE: [[9, 11, "Genfer Bettag"]],
  GL: [[1, 2, "Berchtoldstag"], [11, 1, "Allerheiligen"]],
  GR: [[1, 2, "Berchtoldstag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  JU: [[5, 1, "Tag der Arbeit"], [6, 23, "Fête-Dieu"], [11, 1, "Allerheiligen"]],
  LU: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  NE: [[3, 1, "Fastnachtsmontag"], [9, 24, "Jeûne fédéral"]],
  NW: [[1, 2, "Berchtoldstag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  OW: [[1, 2, "Berchtoldstag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  SG: [[1, 2, "Berchtoldstag"], [11, 1, "Allerheiligen"]],
  SH: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
  SO: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
  SZ: [[1, 2, "Berchtoldstag"], [3, 19, "Josefitag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  TG: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
  TI: [[1, 6, "Heilige Drei Könige"], [3, 19, "Josefitag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"], [12, 8, "Mariä Empfängnis"]],
  UR: [[1, 2, "Berchtoldstag"], [3, 19, "Josefitag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  VD: [[9, 24, "Jeûne fédéral"]],
  VS: [[1, 2, "Berchtoldstag"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"], [12, 8, "Mariä Empfängnis"]],
  ZG: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [8, 15, "Mariä Himmelfahrt"], [11, 1, "Allerheiligen"]],
  ZH: [[1, 2, "Berchtoldstag"], [5, 1, "Tag der Arbeit"], [11, 1, "Allerheiligen"]],
};

function addSwissHolidays(year: number, region: string): Holiday[] {
  const easter = easterSunday(year);
  const holidays = [
    holiday(dateAtNoon(year, 1, 1), "Neujahr"),
    holiday(addDays(easter, -2), "Karfreitag"),
    holiday(addDays(easter, 1), "Ostermontag"),
    holiday(addDays(easter, 39), "Auffahrt"),
    holiday(addDays(easter, 50), "Pfingstmontag"),
    holiday(dateAtNoon(year, 8, 1), "Bundesfeier"),
    holiday(dateAtNoon(year, 12, 25), "Weihnachten"),
    holiday(dateAtNoon(year, 12, 26), "Stephanstag"),
  ];
  for (const [month, day, name] of SWISS_EXTRA_HOLIDAYS[region] ?? []) {
    holidays.push(holiday(dateAtNoon(year, month, day), name));
  }
  return holidays;
}

export function getHolidays(country: HolidayCountry, region: string, year: number): Holiday[] {
  const holidays = country === "de"
    ? addCommonGermanHolidays(year, region)
    : country === "at"
      ? addAustrianHolidays(year, region)
      : addSwissHolidays(year, region);
  return holidays
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .filter((item, index, all) => index === all.findIndex(other => other.date.getTime() === item.date.getTime() && other.name === item.name));
}

export function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function getRegion(country: HolidayCountry, code: string) {
  return HOLIDAY_REGIONS.find(region => region.country === country && region.code === code) ?? HOLIDAY_REGIONS.find(region => region.country === country)!;
}

export function getNextHoliday(country: HolidayCountry, region: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  return [...getHolidays(country, region, now.getFullYear()), ...getHolidays(country, region, now.getFullYear() + 1)]
    .find(item => item.date.getTime() >= today);
}

export function getVacationRecommendations(country: HolidayCountry, region: string, now = new Date()): VacationRecommendation[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const holidays = [...getHolidays(country, region, now.getFullYear()), ...getHolidays(country, region, now.getFullYear() + 1)];
  const recommendations: VacationRecommendation[] = [];
  for (const item of holidays) {
    if (item.date.getTime() < today || isWeekend(item.date)) continue;
    const day = item.date.getDay();
    const vacationDates = day === 1
      ? [addDays(item.date, -3)]
      : day === 2
        ? [addDays(item.date, -1)]
        : day === 3
          ? [addDays(item.date, -2), addDays(item.date, -1)]
          : day === 4 || day === 5
            ? [addDays(item.date, 1)]
          : [];
    if (vacationDates.length === 0 || vacationDates.some(date => date.getTime() < today)) continue;
    const freeDays = vacationDates.length === 1 ? 4 : 5;
    recommendations.push({
      holiday: item,
      vacationDates,
      freeDays,
      explanation: `${vacationDates.length} Urlaubstag${vacationDates.length === 1 ? "" : "e"} nutzen und ${freeDays} freie Tage erhalten`,
    });
  }
  return recommendations
    .filter((recommendation, index, all) => index === all.findIndex(other => other.holiday.date.getTime() === recommendation.holiday.date.getTime()))
    .slice(0, 6);
}

export function formatHolidayDate(date: Date) {
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatHolidayShortDate(date: Date) {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}