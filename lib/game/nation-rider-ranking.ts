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
  return riders
    .map((rider) => ({
      ...rider,
      overall: calculateNationRiderOverall(rider.ratings),
    }))
    .sort(
      (left, right) =>
        right.overall - left.overall ||
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr"),
    )
    .slice(0, Math.max(0, limit));
}
