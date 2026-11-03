export type DailyFormCampRiderReport = {
  riderId: string;
  firstName: string;
  lastName: string;
  campType: "classic" | "premium";
  startDayNumber: number;
  endDayNumber: number;
  formBefore: number;
  formAfter: number;
  formDelta: number;
};

export type DailyFormCampReport = {
  teamName: string;
  seasonName: string;
  dayNumber: number;
  currentDayNumber: number;
  calendarDate: string;
  riders: DailyFormCampRiderReport[];
  riderCount: number;
  totalFormGain: number;
};

export function parseFormCampReportDay(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,2}$/.test(raw)) return null;
  const day = Number(raw);
  return day >= 1 && day <= 28 ? day : null;
}

export function normalizeDailyFormCampReport(value: unknown): DailyFormCampReport | null {
  const row = asRecord(value);
  if (!row || !nonempty(row.teamName) || !nonempty(row.seasonName) ||
    !isDay(row.dayNumber) || !isDay(row.currentDayNumber) ||
    row.dayNumber > Math.max(1, row.currentDayNumber - 1) ||
    typeof row.calendarDate !== "string" || !isCalendarDate(row.calendarDate) ||
    !Array.isArray(row.riders) ||
    (row.currentDayNumber === 1 && row.riders.length > 0)) return null;

  const dayNumber = row.dayNumber;
  const seen = new Set<string>();
  const riders = row.riders.flatMap((value): DailyFormCampRiderReport[] => {
    const rider = asRecord(value);
    if (!rider || typeof rider.riderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rider.riderId) ||
      seen.has(rider.riderId) || !nonempty(rider.firstName) || !nonempty(rider.lastName) ||
      (rider.campType !== "classic" && rider.campType !== "premium") ||
      !isDay(rider.startDayNumber) || !isDay(rider.endDayNumber) ||
      rider.startDayNumber > dayNumber || rider.endDayNumber < dayNumber ||
      !isForm(rider.formBefore) || !isForm(rider.formAfter) ||
      rider.formAfter < rider.formBefore) return [];
    seen.add(rider.riderId);
    return [{
      riderId: rider.riderId,
      firstName: rider.firstName.trim(),
      lastName: rider.lastName.trim(),
      campType: rider.campType,
      startDayNumber: rider.startDayNumber,
      endDayNumber: rider.endDayNumber,
      formBefore: rider.formBefore,
      formAfter: rider.formAfter,
      // The nominal camp delta can exceed the remaining room below 100.
      formDelta: roundFormCampValue(rider.formAfter - rider.formBefore),
    }];
  }).sort((left, right) =>
    `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`, "fr"));

  return {
    teamName: row.teamName.trim(),
    seasonName: row.seasonName.trim(),
    dayNumber: row.dayNumber,
    currentDayNumber: row.currentDayNumber,
    calendarDate: row.calendarDate,
    riders,
    riderCount: riders.length,
    totalFormGain: roundFormCampValue(riders.reduce((total, rider) => total + rider.formDelta, 0)),
  };
}

export function formatFormCampValue(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function roundFormCampValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 28;
}

function isForm(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
