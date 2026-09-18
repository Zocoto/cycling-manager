import type { RiderSimulationRatings } from "./race-simulation";

export const FAVORITE_RACE_RATING_BONUS = 2;

const RATING_KEYS = [
  "flat",
  "mountain",
  "hills",
  "cobbles",
  "downhill",
  "sprint",
  "acceleration",
  "timeTrial",
  "prologue",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
] as const satisfies readonly (keyof RiderSimulationRatings)[];

export function applyFavoriteRaceRatingBonus(
  ratings: RiderSimulationRatings,
  bonus: number | undefined,
): RiderSimulationRatings {
  if (bonus !== FAVORITE_RACE_RATING_BONUS) return ratings;

  return Object.fromEntries(
    RATING_KEYS.map((key) => [key, Math.min(100, ratings[key] + bonus)]),
  ) as RiderSimulationRatings;
}

export function addFavoriteRaceBonusToRiders<T extends { id: string }>(
  riders: T[],
  favoriteRiderIds: ReadonlySet<string> | undefined,
): Array<T & { favoriteRaceBonus?: number }> {
  if (!favoriteRiderIds?.size) return riders;
  return riders.map((rider) =>
    favoriteRiderIds.has(rider.id)
      ? { ...rider, favoriteRaceBonus: FAVORITE_RACE_RATING_BONUS }
      : rider,
  );
}
