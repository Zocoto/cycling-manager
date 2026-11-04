import type { PcmExportSnapshot } from "./types";

/** Keep only clubs which will actually own a rider in the generated database. */
export function withoutEmptyPcmTeams(snapshot: PcmExportSnapshot): PcmExportSnapshot {
  // Match the builder's effective contract selection without changing gala
  // club-at-registration assignments or imposing a minimum roster size.
  const contractsByRider = new Map(snapshot.contracts.map(row => [row.rider_id, row]));
  const populatedTeams = new Set(snapshot.riders.flatMap(rider => {
    const contract = contractsByRider.get(rider.id);
    return contract ? [contract.team_id] : [];
  }));
  const teamSeasons = snapshot.teamSeasons.filter(row => populatedTeams.has(row.team_id));
  const exportedTeams = new Set(teamSeasons.map(row => row.team_id));
  return {
    ...snapshot,
    teamSeasons,
    teams: snapshot.teams.filter(row => exportedTeams.has(row.id)),
    counts: { ...snapshot.counts, teams: teamSeasons.length },
  };
}
