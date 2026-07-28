export function isGameYearCoveredBySponsorContract({
  gameYear,
  startGameYear,
  endGameYear,
}: {
  gameYear: number;
  startGameYear: number | undefined;
  endGameYear: number | null | undefined;
}): boolean {
  if (startGameYear === undefined || endGameYear === undefined) {
    return false;
  }

  return (
    gameYear >= startGameYear &&
    (endGameYear === null || gameYear <= endGameYear)
  );
}