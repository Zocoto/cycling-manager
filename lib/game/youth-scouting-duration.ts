export const YOUTH_SCOUTING_MIN_DURATION_DAYS = 3;
export const YOUTH_SCOUTING_MAX_DURATION_DAYS = 7;
export const YOUTH_SCOUTING_LAST_SEASON_DAY = 28;

export const YOUTH_SCOUTING_DURATION_OPTIONS = Array.from(
  {
    length:
      YOUTH_SCOUTING_MAX_DURATION_DAYS -
      YOUTH_SCOUTING_MIN_DURATION_DAYS +
      1,
  },
  (_, index) => YOUTH_SCOUTING_MIN_DURATION_DAYS + index,
);

export function isValidYouthScoutingDuration(durationDays: number) {
  return (
    Number.isInteger(durationDays) &&
    durationDays >= YOUTH_SCOUTING_MIN_DURATION_DAYS &&
    durationDays <= YOUTH_SCOUTING_MAX_DURATION_DAYS
  );
}

export function getYouthScoutingDurationOptionsForDay(
  currentDayNumber: number,
) {
  if (!Number.isInteger(currentDayNumber)) return [];

  return YOUTH_SCOUTING_DURATION_OPTIONS.filter(
    (durationDays) =>
      currentDayNumber + durationDays <= YOUTH_SCOUTING_LAST_SEASON_DAY,
  );
}
