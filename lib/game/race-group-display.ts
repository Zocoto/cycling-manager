/** Presentation only: never reorder the snapshot used for race positions. */
export function prioritizeOwnRaceGroupRiders(
  riderIds: readonly string[],
  ownRiderIds: ReadonlySet<string>,
): readonly string[] {
  if (!ownRiderIds.size) return riderIds;
  const own: string[] = [];
  const others: string[] = [];
  for (const riderId of riderIds) {
    (ownRiderIds.has(riderId) ? own : others).push(riderId);
  }
  return own.length && others.length ? [...own, ...others] : riderIds;
}
