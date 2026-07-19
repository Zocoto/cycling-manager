export const GAMEPLAY_RULES = {
  sponsoringUnlockReputation: 30,
} as const;

export function isSponsoringUnlocked(
  reputationPoints: number
): boolean {
  return (
    Math.max(0, Math.floor(reputationPoints)) >=
    GAMEPLAY_RULES.sponsoringUnlockReputation
  );
}

export function getSponsoringUnlockProgress(
  reputationPoints: number
): number {
  const threshold = GAMEPLAY_RULES.sponsoringUnlockReputation;

  if (threshold <= 0) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(0, Math.round((reputationPoints / threshold) * 100))
  );
}
