/** Optional final-sprint preferences: never change roles, missions or attacks. */
export type SprintTrainRider = {
  id: string;
  ratings: { flat: number; sprint: number; acceleration: number };
  energy?: number;
};

export const MINIMUM_SPRINT_TRAIN_ENERGY = 18;

/** Tolerate old snapshots, duplicates and stale IDs instead of rejecting a race. */
export function readSprintTrainOrder(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
}

function energy(rider: SprintTrainRider) {
  return Number.isFinite(rider.energy) ? Math.max(0, Math.min(100, rider.energy!)) : 75;
}

function relayRating(rider: SprintTrainRider, progress: number) {
  // Early relays emphasize flat power; the last relay emphasizes SPR / ACC.
  return rider.ratings.flat * (0.5 - progress * 0.34)
    + rider.ratings.sprint * (0.2 + progress * 0.08)
    + rider.ratings.acceleration * (0.1 + progress * 0.16)
    + energy(rider) * (0.2 + progress * 0.1);
}

export function orderSprintTrain<T extends SprintTrainRider>(
  riders: readonly T[],
  preferredOrder: unknown = [],
): T[] {
  // Sorting by the difference between last/first-relay suitability optimizes
  // this linear assignment without factorial search, regardless of team size.
  const automatic = [...riders].sort((a, b) =>
    (relayRating(a, 1) - relayRating(a, 0)) - (relayRating(b, 1) - relayRating(b, 0))
    || a.id.localeCompare(b.id),
  );
  const byId = new Map(automatic.map((rider) => [rider.id, rider]));
  const preferred = readSprintTrainOrder(preferredOrder).flatMap((id) => {
    const rider = byId.get(id);
    if (!rider) return [];
    byId.delete(id);
    return [rider];
  });
  return [...preferred, ...automatic.filter((rider) => byId.has(rider.id))];
}

export function getSprintTrainRelayAdjustment(riders: readonly SprintTrainRider[]) {
  if (riders.length < 2) return 0;
  const baseline = riders.reduce((total, rider) => total + relayRating(rider, 0.5), 0) / riders.length;
  const ordered = riders.reduce((total, rider, index) =>
    total + relayRating(rider, index / (riders.length - 1)), 0) / riders.length;
  // Preserve the existing collective strength scale. No extra energy charge or
  // stacking of doctrine bonuses; order can only modestly change positioning.
  return Math.max(-3, Math.min(3, ordered - baseline));
}
