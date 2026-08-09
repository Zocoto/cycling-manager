export type TeamContractRiderStatus =
  | "eligible"
  | "renewed"
  | "covered"
  | "leaving";

export function resolveTeamContractRiderStatus({
  currentContractEndYear,
  currentSeasonYear,
  currentTeamId,
  successorTeamId,
}: {
  currentContractEndYear: number;
  currentSeasonYear: number;
  currentTeamId: string;
  successorTeamId: string | null;
}): TeamContractRiderStatus {
  if (currentContractEndYear > currentSeasonYear) return "covered";
  if (successorTeamId === currentTeamId) return "renewed";
  if (successorTeamId) return "leaving";
  return "eligible";
}
