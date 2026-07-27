export const MAX_TEAM_ROSTER_SIZE = 35;

export function isTeamRosterAtCapacity(riderCount: number): boolean {
  return (
    Number.isFinite(riderCount) && riderCount >= MAX_TEAM_ROSTER_SIZE
  );
}
