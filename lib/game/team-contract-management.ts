export type TeamContractRiderStatus =
  | "eligible"
  | "renewed"
  | "covered"
  | "leaving";

export const TWO_SEASON_RENEWAL_PREMIUM_PERCENT = 25;

export function getRiderRenewalTargetYears({
  effectiveContractEndYear,
  currentSeasonYear,
  blockingContracts = [],
}: {
  effectiveContractEndYear: number;
  currentSeasonYear: number;
  blockingContracts?: ReadonlyArray<{ startYear: number; endYear: number }>;
}): number[] {
  if (
    effectiveContractEndYear < currentSeasonYear ||
    effectiveContractEndYear > currentSeasonYear + 1
  ) {
    return [];
  }

  return [currentSeasonYear + 1, currentSeasonYear + 2].filter(
    (targetYear) =>
      targetYear > effectiveContractEndYear &&
      !blockingContracts.some(
        (contract) =>
          contract.startYear <= targetYear &&
          contract.endYear >= effectiveContractEndYear + 1,
      ),
  );
}

export function getRiderRenewalPremiumPercent({
  activeContractEndYear,
  currentSeasonYear,
  targetEndYear,
}: {
  activeContractEndYear: number;
  currentSeasonYear: number;
  targetEndYear: number;
}): number {
  return activeContractEndYear === currentSeasonYear &&
    targetEndYear === currentSeasonYear + 2
    ? TWO_SEASON_RENEWAL_PREMIUM_PERCENT
    : 0;
}

export function calculateRiderRenewalSalary(
  baseSalary: number,
  premiumPercent: number,
): number {
  return Math.round(baseSalary * (1 + premiumPercent / 100) * 100) / 100;
}

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
