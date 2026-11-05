/** Prefer a rendered target, including when responsive copies share an id. */
export function findVisibleTutorialTarget<T>(
  targetIds: readonly (string | undefined)[],
  findCandidates: (targetId: string) => Iterable<T>,
  isVisible: (candidate: T) => boolean,
): T | null {
  for (const targetId of new Set(targetIds)) {
    if (!targetId) continue;
    for (const candidate of findCandidates(targetId)) {
      if (isVisible(candidate)) return candidate;
    }
  }
  return null;
}
