export const RACE_LOAD_START_GAME_YEAR = 5;
export const RACE_LOAD_FREE_DAYS = 30;
export const RACE_LOAD_WARNING_DAYS = 25;

export type RiderSeasonRaceLoad = {
  raceDays: number;
  projectedRaceDays: number;
  warning: "overloaded" | "projected" | "approaching" | null;
};

export function getRiderSeasonRaceLoad(
  gameYear: number,
  raceDays: number,
  remainingRaceDays: number,
): RiderSeasonRaceLoad | null {
  if (!Number.isFinite(gameYear) || gameYear < RACE_LOAD_START_GAME_YEAR) return null;
  const actual = normalizeDays(raceDays);
  const projected = actual + normalizeDays(remainingRaceDays);
  return {
    raceDays: actual,
    projectedRaceDays: projected,
    warning: actual > RACE_LOAD_FREE_DAYS ? "overloaded"
      : projected > RACE_LOAD_FREE_DAYS ? "projected"
      : actual >= RACE_LOAD_WARNING_DAYS ? "approaching" : null,
  };
}

function normalizeDays(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
