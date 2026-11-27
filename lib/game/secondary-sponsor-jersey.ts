type PrincipalJerseySelection = {
  status: "active" | "planned";
  start_season_id: string;
  selected_jersey_id: string | null;
  pending_jersey_id: string | null;
  pending_jersey_season_id: string | null;
};

// A future logo must be placed on a jersey actually chosen for that season.
// The current selection remains independent while the next one is prepared.
export function getSecondarySponsorPrincipalJerseyId(
  contract: PrincipalJerseySelection,
  targetSeason: { id: string; status: string },
): string | null {
  if (targetSeason.status === "active") {
    return contract.status === "active" ? contract.selected_jersey_id : null;
  }
  if (targetSeason.status !== "planned") return null;
  if (contract.status === "planned") {
    return contract.start_season_id === targetSeason.id ? contract.selected_jersey_id : null;
  }
  return contract.pending_jersey_season_id === targetSeason.id
    ? contract.pending_jersey_id
    : null;
}
