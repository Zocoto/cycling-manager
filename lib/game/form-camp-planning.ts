import type { RiderPlanningEvent } from "@/lib/game/rider-season-planning";

export const FORM_CAMP_MAX_DURATION_DAYS = 3;

export type FormCampDayRange = {
  startDay: number;
  endDay: number;
};

export function selectFormCampDayRange({
  currentRange,
  dayNumber,
  currentDayNumber,
}: {
  currentRange: FormCampDayRange | null;
  dayNumber: number;
  currentDayNumber: number;
}): FormCampDayRange | null {
  const day = Math.trunc(dayNumber);
  if (day <= currentDayNumber || day < 1 || day > 28) return currentRange;
  if (!currentRange || currentRange.endDay > currentRange.startDay) {
    return { startDay: day, endDay: day };
  }

  const startDay = Math.min(currentRange.startDay, day);
  const endDay = Math.max(currentRange.startDay, day);
  if (endDay - startDay + 1 > FORM_CAMP_MAX_DURATION_DAYS) {
    return { startDay: day, endDay: day };
  }

  return { startDay, endDay };
}

export function getFormCampRangeDuration(range: FormCampDayRange | null) {
  return range ? range.endDay - range.startDay + 1 : 0;
}

export function findFormCampPlanningConflict(
  events: readonly RiderPlanningEvent[],
  range: FormCampDayRange | null,
) {
  if (!range) return null;

  return (
    events.find(
      (event) =>
        event.startDay <= range.endDay && event.endDay >= range.startDay,
    ) ?? null
  );
}

export function isDayInFormCampRange(
  dayNumber: number,
  range: FormCampDayRange | null,
) {
  return Boolean(
    range && dayNumber >= range.startDay && dayNumber <= range.endDay,
  );
}
