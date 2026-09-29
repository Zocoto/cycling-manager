/**
 * Le chrono collectif doit conserver un noyau suffisamment dense pour que
 * perdre des équipiers ait un coût réel. Une équipe complète peut sacrifier
 * jusqu'à trois coureurs, mais jamais descendre sous quatre unités.
 */
export function getTeamTimeTrialCoreSize(startingRiderCount: number) {
  const normalizedCount = Math.max(0, Math.floor(startingRiderCount));
  if (normalizedCount === 0) return 0;

  return Math.min(normalizedCount, Math.max(4, normalizedCount - 3));
}

/**
 * La perte d'équipiers réduit les possibilités de rotation et de récupération,
 * même lorsque les meilleurs rouleurs restants ont d'excellentes notes.
 */
export function getTeamTimeTrialCohesionMultiplier({
  activeRiderCount,
  startingRiderCount,
}: {
  activeRiderCount: number;
  startingRiderCount: number;
}) {
  if (startingRiderCount <= 0) return 1;

  const remainingRatio = Math.min(
    1,
    Math.max(0, activeRiderCount / startingRiderCount),
  );
  return 0.94 + remainingRatio * 0.06;
}
