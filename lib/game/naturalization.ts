export const GAME_SEASON_DAY_COUNT = 28;
export const PROFESSIONAL_NATURALIZATION_REQUIRED_DAYS =
  GAME_SEASON_DAY_COUNT * 3;
export const YOUTH_NATURALIZATION_REQUIRED_DAYS = GAME_SEASON_DAY_COUNT;

export type NaturalizationLevel = "professional" | "youth";

export type NaturalizationReason =
  | "eligible"
  | "tenure_incomplete"
  | "champion_locked"
  | "same_nationality"
  | "unavailable";

export type NaturalizationCountry = {
  id: string;
  name: string;
  code: string;
};

export type NaturalizationEligibility = {
  level: NaturalizationLevel;
  eligible: boolean;
  reason: NaturalizationReason;
  elapsedDays: number;
  requiredDays: number;
  remainingDays: number;
  currentCountry: NaturalizationCountry;
  targetCountry: NaturalizationCountry;
};

export type ProfessionalContractTenure = {
  startGameYear: number;
  endGameYear: number;
  joinedDayNumber: number;
};

export function shouldDisplayNaturalizationCard(
  eligibility: NaturalizationEligibility | null | undefined,
): eligibility is NaturalizationEligibility {
  return (
    eligibility?.reason === "eligible" ||
    eligibility?.reason === "tenure_incomplete"
  );
}

export function getNaturalizationRequiredDays(
  level: NaturalizationLevel,
): number {
  return level === "professional"
    ? PROFESSIONAL_NATURALIZATION_REQUIRED_DAYS
    : YOUTH_NATURALIZATION_REQUIRED_DAYS;
}

export function calculateInGameTenureDays({
  startGameYear,
  startDayNumber,
  currentGameYear,
  currentDayNumber,
}: {
  startGameYear: number;
  startDayNumber: number;
  currentGameYear: number;
  currentDayNumber: number;
}): number {
  if (currentGameYear < startGameYear) return 0;

  return Math.max(
    0,
    (currentGameYear - startGameYear) * GAME_SEASON_DAY_COUNT +
      clampDay(currentDayNumber) -
      clampDay(startDayNumber),
  );
}

export function findContinuousProfessionalTenureStart({
  currentContract,
  contracts,
}: {
  currentContract: ProfessionalContractTenure;
  contracts: ProfessionalContractTenure[];
}): Pick<
  ProfessionalContractTenure,
  "startGameYear" | "joinedDayNumber"
> {
  let startGameYear = currentContract.startGameYear;
  let joinedDayNumber = clampDay(currentContract.joinedDayNumber);

  while (true) {
    const connectedContracts = contracts.filter(
      (contract) =>
        contract.startGameYear < startGameYear &&
        contract.endGameYear >= startGameYear - 1,
    );
    if (!connectedContracts.length) break;

    const earliest = connectedContracts.sort(
      (left, right) =>
        left.startGameYear - right.startGameYear ||
        left.joinedDayNumber - right.joinedDayNumber,
    )[0];
    if (!earliest || earliest.startGameYear >= startGameYear) break;

    startGameYear = earliest.startGameYear;
    joinedDayNumber = clampDay(earliest.joinedDayNumber);
  }

  return { startGameYear, joinedDayNumber };
}

export function evaluateNaturalizationEligibility({
  level,
  elapsedDays,
  currentCountry,
  targetCountry,
  hasNationalChampionshipTitle = false,
  available = true,
}: {
  level: NaturalizationLevel;
  elapsedDays: number;
  currentCountry: NaturalizationCountry;
  targetCountry: NaturalizationCountry;
  hasNationalChampionshipTitle?: boolean;
  available?: boolean;
}): NaturalizationEligibility {
  const requiredDays = getNaturalizationRequiredDays(level);
  const normalizedElapsedDays = Math.max(0, Math.floor(elapsedDays));
  const remainingDays = Math.max(0, requiredDays - normalizedElapsedDays);

  const reason: NaturalizationReason = !available
    ? "unavailable"
    : currentCountry.id === targetCountry.id
      ? "same_nationality"
      : level === "professional" && hasNationalChampionshipTitle
        ? "champion_locked"
        : remainingDays > 0
          ? "tenure_incomplete"
          : "eligible";

  return {
    level,
    eligible: reason === "eligible",
    reason,
    elapsedDays: normalizedElapsedDays,
    requiredDays,
    remainingDays,
    currentCountry,
    targetCountry,
  };
}

function clampDay(value: number): number {
  return Math.min(
    GAME_SEASON_DAY_COUNT,
    Math.max(1, Math.floor(Number.isFinite(value) ? value : 1)),
  );
}
