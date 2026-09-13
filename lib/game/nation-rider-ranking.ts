export type NationRiderRatings = {
  mountain: number;
  hills: number;
  flat: number;
  timeTrial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type NationRiderCandidate = {
  firstName: string;
  lastName: string;
  ratings: NationRiderRatings;
};

export const NATION_RIDER_PRIMARY_RATING_KEYS = [
  "mountain",
  "hills",
  "flat",
  "timeTrial",
  "cobbles",
  "sprint",
] as const satisfies ReadonlyArray<keyof NationRiderRatings>;

export type NationRiderRankingMetric =
  | "overall"
  | (typeof NATION_RIDER_PRIMARY_RATING_KEYS)[number];

const ratingKeys = [
  "mountain",
  "hills",
  "flat",
  "timeTrial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const satisfies ReadonlyArray<keyof NationRiderRatings>;

export function calculateNationRiderOverall(
  ratings: NationRiderRatings,
): number {
  const total = ratingKeys.reduce((sum, key) => sum + ratings[key], 0);
  return Math.round((total / ratingKeys.length) * 100) / 100;
}

export function rankNationRiders<T extends NationRiderCandidate>(
  riders: readonly T[],
  limit = 5,
): Array<T & { overall: number }> {
  return rankNationRidersByMetric(riders, "overall").slice(
    0,
    Math.max(0, limit),
  );
}

export function rankNationRidersByMetric<T extends NationRiderCandidate>(
  riders: readonly T[],
  metric: NationRiderRankingMetric,
): Array<T & { overall: number }> {
  return riders
    .map((rider, originalIndex) => ({
      rider: {
        ...rider,
        overall: calculateNationRiderOverall(rider.ratings),
      },
      originalIndex,
    }))
    .sort((leftEntry, rightEntry) => {
      const left = leftEntry.rider;
      const right = rightEntry.rider;
      const metricDifference =
        metric === "overall"
          ? right.overall - left.overall
          : right.ratings[metric] - left.ratings[metric];

      return (
        metricDifference ||
        right.overall - left.overall ||
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr") ||
        leftEntry.originalIndex - rightEntry.originalIndex
      );
    })
    .map(({ rider }) => rider);
}
