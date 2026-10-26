import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import type { SponsorPrestige } from "@/types/sponsor";

export const SPONSOR_MAIN_OBJECTIVE_START_GAME_YEAR = 4;
export const SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR = 5;

export type SponsorMainObjectiveTerms = {
  cashReward: number;
  currencyCode: string;
  reputationPenalty: number;
  raceCategoryCode: RaceCategoryCode;
  settlementStatus: "pending" | "achieved" | "failed" | "cancelled";
};

const CASH_REWARD_BY_CATEGORY: Record<RaceCategoryCode, number> = {
  local: 60_000,
  regional: 60_000,
  national: 100_000,
  continental: 180_000,
  world: 300_000,
  elite: 450_000,
};

const REPUTATION_PENALTY_BY_CATEGORY: Record<RaceCategoryCode, number> = {
  local: 10,
  regional: 10,
  national: 20,
  continental: 30,
  world: 45,
  elite: 60,
};

const CATEGORY_SCORE: Record<RaceCategoryCode, number> = {
  local: 0,
  regional: 0,
  national: 1,
  continental: 2,
  world: 3,
  elite: 4,
};

export function calculateSponsorMainObjectiveTerms({
  sponsorPrestige,
  raceCategoryCode,
  targetRank,
  targetSeasonGameYear,
  annualSponsorBudget,
}: {
  sponsorPrestige: SponsorPrestige;
  raceCategoryCode: RaceCategoryCode;
  targetRank: number;
  targetSeasonGameYear: number;
  annualSponsorBudget: number;
}): Pick<SponsorMainObjectiveTerms, "cashReward" | "reputationPenalty"> {
  if (!Number.isInteger(targetSeasonGameYear) || targetSeasonGameYear < 1) {
    throw new Error("La saison des objectifs sponsor est invalide.");
  }
  if (!Number.isFinite(annualSponsorBudget) || annualSponsorBudget <= 0) {
    throw new Error("Le budget annuel du sponsor doit être un montant strictement positif.");
  }
  const normalizedRank = Math.max(1, Math.floor(targetRank));
  const prestigeMultiplier = 0.8 + sponsorPrestige * 0.12;
  const difficultyMultiplier = normalizedRank === 1 ? 1.2 : normalizedRank <= 3 ? 1.08 : 1;

  const legacyTerms = {
    cashReward:
      Math.round(
        (CASH_REWARD_BY_CATEGORY[raceCategoryCode] *
          prestigeMultiplier *
          difficultyMultiplier) /
          5_000,
      ) * 5_000,
    reputationPenalty:
      REPUTATION_PENALTY_BY_CATEGORY[raceCategoryCode] +
      (sponsorPrestige - 1) * 5,
  };

  if (targetSeasonGameYear < SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR) {
    return legacyTerms;
  }

  // The database stores budgets to two decimals. Integer cents avoid floating
  // point artefacts at exact cent boundaries (notably the 12.5% podium cap).
  const budgetCents = Math.round(annualSponsorBudget * 100);
  if (!Number.isSafeInteger(budgetCents * 3)) {
    throw new Error("Le budget annuel du sponsor doit être un montant strictement positif.");
  }
  const budgetCapCents = normalizedRank === 1
    ? Math.floor(budgetCents * 3 / 20)
    : normalizedRank <= 3 ? Math.floor(budgetCents / 8) : Math.floor(budgetCents / 10);
  // Round down so the display step never takes a reward above its budget cap.
  // Small sponsors keep a usable amount rather than a zero-euro reward.
  const roundedBudgetCap = (budgetCapCents >= 500_000
    ? Math.floor(budgetCapCents / 500_000) * 500_000
    : budgetCapCents) / 100;
  if (roundedBudgetCap < 0.01) {
    throw new Error("Le budget annuel du sponsor est trop faible pour calculer une prime.");
  }
  const cashReward = Math.min(legacyTerms.cashReward, roundedBudgetCap);
  return {
    cashReward,
    reputationPenalty: Math.max(
      1,
      Math.round(legacyTerms.reputationPenalty * cashReward / legacyTerms.cashReward),
    ),
  };
}

export function getSponsorMainObjectiveCandidateScore({
  raceCategoryCode,
  targetRank,
}: {
  raceCategoryCode: RaceCategoryCode;
  targetRank: number;
}): number {
  const normalizedRank = Math.max(1, Math.floor(targetRank));
  return CATEGORY_SCORE[raceCategoryCode] * 100 + Math.max(0, 25 - normalizedRank);
}

export function selectSponsorMainObjectiveOfferId(
  offerIds: readonly string[],
  seed: string,
): string | null {
  const uniqueOfferIds = [...new Set(offerIds.filter(Boolean))];
  if (uniqueOfferIds.length === 0) return null;

  if (uniqueOfferIds.length === 1) {
    return stableHash(`${seed}:${uniqueOfferIds[0]}`) % 3 === 0
      ? uniqueOfferIds[0]
      : null;
  }

  return [...uniqueOfferIds].sort(
    (first, second) =>
      stableHash(`${seed}:${first}`) - stableHash(`${seed}:${second}`) ||
      first.localeCompare(second),
  )[0];
}

export function stableHash(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
