export const PERFORMANCE_PREPARATION_DAYS = 2;

export type PerformancePreparationPolicy = Readonly<{
  ratingBonus: number;
  bonusDays: number;
  capacity: number;
}>;

const POLICIES: readonly PerformancePreparationPolicy[] = [
  { ratingBonus: 1, bonusDays: 3, capacity: 1 },
  { ratingBonus: 1.5, bonusDays: 4, capacity: 1 },
  { ratingBonus: 2, bonusDays: 4, capacity: 2 },
  { ratingBonus: 2.5, bonusDays: 5, capacity: 2 },
  { ratingBonus: 3, bonusDays: 6, capacity: 3 },
];

/** Base values; the architect multiplier is captured by the server on booking. */
export function getPerformancePreparationPolicy(
  buildingLevel: number,
): PerformancePreparationPolicy | null {
  if (!Number.isInteger(buildingLevel) || buildingLevel < 1 || buildingLevel > 5) {
    return null;
  }
  return POLICIES[buildingLevel - 1];
}
