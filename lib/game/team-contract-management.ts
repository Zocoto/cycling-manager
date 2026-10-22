export type TeamContractRiderStatus =
  | "eligible"
  | "renewed"
  | "covered"
  | "leaving";

export const TWO_SEASON_RENEWAL_PREMIUM_PERCENT = 10;

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
  age,
}: {
  activeContractEndYear: number;
  currentSeasonYear: number;
  targetEndYear: number;
  age: number;
}): number {
  return activeContractEndYear === currentSeasonYear &&
    targetEndYear === currentSeasonYear + 2
    ? age > 30 ? -25 : age < 25 ? 25 : TWO_SEASON_RENEWAL_PREMIUM_PERCENT
    : 0;
}

export function calculateRiderRenewalSalary(
  baseSalary: number,
  premiumPercent: number,
): number {
  return Math.round(baseSalary * (1 + premiumPercent / 100) * 100) / 100;
}

export function getRiderRenewalUpgradeBaseSalary({
  estimatedSalary,
  homegrown,
  homegrownSalaryBeforeDiscount,
  rosterSalaryBeforeDiscount,
  salaryPerSeason,
  renewalDiscountPercent,
}: {
  estimatedSalary: number;
  homegrown: boolean;
  homegrownSalaryBeforeDiscount?: number | string | null;
  rosterSalaryBeforeDiscount?: number | string | null;
  salaryPerSeason: number | string;
  renewalDiscountPercent: number;
}): number {
  // A legacy zero-salary academy deal must not make its upgrade free. Keep
  // valid signed bases and the existing discount order; only invalid/nonpositive
  // bases fall back to the current salary quote.
  const quotedSalary = toPositiveSalary(estimatedSalary) ?? 6_000;
  const baseSalary = homegrown
    ? (toPositiveSalary(homegrownSalaryBeforeDiscount) ?? quotedSalary) / 2
    : toPositiveSalary(rosterSalaryBeforeDiscount) ??
      toPositiveSalary(salaryPerSeason) ??
      quotedSalary;
  return Math.round(baseSalary * (1 - renewalDiscountPercent / 100) * 100) / 100;
}

function toPositiveSalary(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
