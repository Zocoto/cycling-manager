export type CalendarRiderOwnership = {
  race_edition_id: string;
  rider_id: string;
  team_id: string;
};

export function resolveRaceViewerTeamId(
  teamId: string | null | undefined | Promise<string | null>,
): Promise<string | null> {
  // Attach the rejection handler immediately: the optional header may fail
  // while the independent calendar queries are still loading.
  return Promise.resolve(teamId).then(
    (identity) => identity ?? null,
    () => null,
  );
}

/**
 * Rendering-only membership. Club startlists expose club IDs, but federation
 * startlists expose registration IDs instead: only the separately loaded active
 * club contracts can establish ownership for those editions.
 */
export function getViewerRiderIdsByEdition(
  rows: readonly CalendarRiderOwnership[],
  viewerTeamId: string | null | undefined,
  nationalOwnership?: {
    editionIds: ReadonlySet<string>;
    riderIds: ReadonlySet<string>;
  },
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!viewerTeamId) return result;

  const ownersByEdition = new Map<string, Map<string, string | null>>();
  for (const row of rows) {
    if (!row.race_edition_id || !row.rider_id) continue;

    const isNationalEdition = nationalOwnership?.editionIds.has(row.race_edition_id);
    if (isNationalEdition && !nationalOwnership?.riderIds.has(row.rider_id)) continue;
    if (!isNationalEdition && !row.team_id) continue;
    const ownerId = isNationalEdition ? viewerTeamId : row.team_id;

    let owners = ownersByEdition.get(row.race_edition_id);
    if (!owners) {
      owners = new Map();
      ownersByEdition.set(row.race_edition_id, owners);
    }

    const previousOwner = owners.get(row.rider_id);
    owners.set(
      row.rider_id,
      previousOwner === undefined || previousOwner === ownerId
        ? ownerId
        : null,
    );
  }

  for (const [editionId, owners] of ownersByEdition) {
    const riderIds = [...owners]
      .filter(([, teamId]) => teamId === viewerTeamId)
      .map(([riderId]) => riderId);
    if (riderIds.length > 0) result.set(editionId, riderIds);
  }

  return result;
}
