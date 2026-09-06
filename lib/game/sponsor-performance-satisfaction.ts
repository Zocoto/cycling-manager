export const SPONSOR_PERFORMANCE_SATISFACTION_START_GAME_YEAR = 3;
export const SPONSOR_PERFORMANCE_SATISFACTION_MAXIMUM = 25;

export function isSponsorPerformanceSatisfactionEnabled(gameYear: number) {
  return gameYear >= SPONSOR_PERFORMANCE_SATISFACTION_START_GAME_YEAR;
}

export function calculateSponsorSatisfactionScore({
  objectivePoints,
  performancePoints,
  gameYear,
}: {
  objectivePoints: number;
  performancePoints: number;
  gameYear: number;
}) {
  const normalizedObjectivePoints = normalizePoints(objectivePoints, 100);
  const normalizedPerformancePoints = isSponsorPerformanceSatisfactionEnabled(
    gameYear,
  )
    ? normalizePoints(
        performancePoints,
        SPONSOR_PERFORMANCE_SATISFACTION_MAXIMUM,
      )
    : 0;

  return Math.min(
    100,
    normalizedObjectivePoints + normalizedPerformancePoints,
  );
}

function normalizePoints(value: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
}
