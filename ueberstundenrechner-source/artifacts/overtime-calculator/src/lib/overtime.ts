export type TimeModel = "normal" | "gleitzeit";
export type WorkCountry = "de" | "at" | "ch";

export const WORK_COUNTRY_LABELS: Record<WorkCountry, string> = {
  de: "Deutschland",
  at: "Österreich",
  ch: "Schweiz",
};

interface BreakRule {
  afterGrossMinutes: number;
  minimumMinutes: number;
}

export interface WorkTimeRules {
  country: WorkCountry;
  shortName: string;
  breakRules: BreakRule[];
  maxDailyNetHours: number;
}

// The calculator uses the country-specific statutory break thresholds and daily
// maximums as practical warnings. Collective agreements and exceptions can differ.
export const WORK_TIME_RULES: Record<WorkCountry, WorkTimeRules> = {
  de: {
    country: "de",
    shortName: "deutschem ArbZG",
    breakRules: [
      { afterGrossMinutes: 6 * 60, minimumMinutes: 30 },
      { afterGrossMinutes: 9 * 60, minimumMinutes: 45 },
    ],
    maxDailyNetHours: 10,
  },
  at: {
    country: "at",
    shortName: "österreichischem AZG",
    breakRules: [{ afterGrossMinutes: 6 * 60, minimumMinutes: 30 }],
    maxDailyNetHours: 12,
  },
  ch: {
    country: "ch",
    shortName: "schweizerischem Arbeitsgesetz",
    breakRules: [
      { afterGrossMinutes: 5.5 * 60, minimumMinutes: 15 },
      { afterGrossMinutes: 7 * 60, minimumMinutes: 30 },
      { afterGrossMinutes: 9 * 60, minimumMinutes: 60 },
    ],
    maxDailyNetHours: 14,
  },
};

export function getWorkTimeRules(country: WorkCountry = "de") {
  return WORK_TIME_RULES[country];
}

export interface CalculationInput {
  country?: WorkCountry;
  model: TimeModel;
  shiftStart: string; // HH:MM
  shiftEnd: string; // HH:MM
  breakMinutes: number;
  scheduledNetHours?: number;
  clockIn: string; // HH:MM
  clockOut: string; // HH:MM
  countAfterSpecificTime: boolean;
  thresholdTime: string; // HH:MM
  targetHours: number; // Sollarbeitszeit
}

export interface CalculationResult {
  grossMinutes: number;
  netMinutes: number;
  breakUsed: number;
  legalMinimumBreak: number;
  breakWarning: boolean;
  overtimeMinutes: number;
  undertimeMinutes: number;
  maxHoursWarning: boolean; // Net work exceeds the selected country's daily maximum.
}

// Return the statutory break minimum for an elapsed shift length in the selected country.
export function getLegalMinimumBreak(country: WorkCountry, grossMinutes: number): number {
  return getWorkTimeRules(country).breakRules.reduce(
    (minimum, rule) => grossMinutes > rule.afterGrossMinutes ? rule.minimumMinutes : minimum,
    0,
  );
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function getMinutesDiff(startStr: string, endStr: string): number {
  const start = timeToMinutes(startStr);
  let end = timeToMinutes(endStr);
  if (end < start) {
    // Passed midnight
    end += 24 * 60;
  }
  return end - start;
}

export function calculateOvertime(input: CalculationInput): CalculationResult {
  const {
    country = "de",
    model,
    shiftStart,
    shiftEnd,
    breakMinutes,
    scheduledNetHours,
    clockIn,
    clockOut,
    countAfterSpecificTime,
    thresholdTime,
    targetHours,
  } = input;

  const grossMinutes = getMinutesDiff(clockIn, clockOut);
  const rules = getWorkTimeRules(country);

  // Legal break calculation for the selected country.
  const legalMinimumBreak = getLegalMinimumBreak(country, grossMinutes);

  const breakWarning = breakMinutes < legalMinimumBreak;
  const effectiveBreak = Math.max(breakMinutes, legalMinimumBreak);
  
  const netMinutes = Math.max(0, grossMinutes - effectiveBreak);
  const maxHoursWarning = netMinutes > rules.maxDailyNetHours * 60;

  let overtimeMinutes = 0;
  let undertimeMinutes = 0;

  if (model === "normal") {
    if (countAfterSpecificTime && thresholdTime) {
      const thresholdDiff = getMinutesDiff(thresholdTime, clockOut);
      overtimeMinutes = Math.max(0, thresholdDiff);
    } else if (scheduledNetHours !== undefined) {
      // Weekend shifts can use a separate planned net-hours target.
      overtimeMinutes = Math.max(0, netMinutes - scheduledNetHours * 60);
    } else {
      const scheduledShiftMinutes = getMinutesDiff(shiftStart, shiftEnd);
      const scheduledNetMinutes = Math.max(0, scheduledShiftMinutes - effectiveBreak);
      overtimeMinutes = Math.max(0, netMinutes - scheduledNetMinutes);
    }
  } else if (model === "gleitzeit") {
    const targetMinutes = targetHours * 60;
    
    if (countAfterSpecificTime && thresholdTime) {
      const thresholdDiff = getMinutesDiff(thresholdTime, clockOut);
      overtimeMinutes = Math.max(0, thresholdDiff);
      
      // Calculate undertime if net < target
      if (netMinutes < targetMinutes) {
        undertimeMinutes = targetMinutes - netMinutes;
      }
    } else {
      if (netMinutes > targetMinutes) {
        overtimeMinutes = netMinutes - targetMinutes;
      } else if (netMinutes < targetMinutes) {
        undertimeMinutes = targetMinutes - netMinutes;
      }
    }
  }

  return {
    grossMinutes,
    netMinutes,
    breakUsed: effectiveBreak,
    legalMinimumBreak,
    breakWarning,
    overtimeMinutes,
    undertimeMinutes,
    maxHoursWarning,
  };
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function formatDecimal(totalMinutes: number): string {
  return (totalMinutes / 60).toFixed(2);
}
