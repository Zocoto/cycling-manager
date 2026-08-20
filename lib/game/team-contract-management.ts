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

export function resolveEffectiveTeamContractEndYear({
  currentContractEndYear,
  currentTeamId,
  successorTeamId,
  successorContractEndYear,
}: {
  currentContractEndYear: number;
  currentTeamId: string;
  successorTeamId: string | null;
  successorContractEndYear: number | null;
}): number {
  if (
    successorTeamId === currentTeamId &&
    successorContractEndYear !== null
  ) {
    return Math.max(currentContractEndYear, successorContractEndYear);
  }

  return currentContractEndYear;
}

export function canRenewCurrentTeamRiderContract({
  currentContractEndYear,
  currentSeasonYear,
  hasNextSeasonContract,
}: {
  currentContractEndYear: number;
  currentSeasonYear: number;
  hasNextSeasonContract: boolean;
}): boolean {
  return (
    currentContractEndYear <= currentSeasonYear && !hasNextSeasonContract
  );
}
