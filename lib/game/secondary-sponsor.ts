import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import type { SponsorPrestige } from "@/types/sponsor";

export const SECONDARY_SPONSOR_REPUTATION_THRESHOLD = 1_500;
export const SECONDARY_SPONSOR_START_GAME_YEAR = 4;
export const SECONDARY_SPONSOR_OFFER_COUNT = 3;
export const SECONDARY_SPONSOR_GENERATION_VERSION = 2;
export const SECONDARY_SPONSOR_BUDGET_PERCENT = 30;
export type SecondarySponsorLogoColorMode = "original" | "black" | "white";

export type SecondarySponsorLogoVariant =
  | "badge"
  | "monogram"
  | "orbit"
  | "stripe"
  | "wordmark";

export type SecondarySponsorIdentity = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  prestige: SponsorPrestige;
  primaryColor: string;
  accentColor: string;
  logoVariant: SecondarySponsorLogoVariant;
};

export type SecondarySponsorLogoPlacement = {
  xPercent: number;
  yPercent: number;
  scale: number;
  rotationDegrees: number;
  colorMode?: SecondarySponsorLogoColorMode;
};

export type SecondarySponsorObjective = {
  id: string;
  name: string;
  cashReward: number;
  reputationPenalty?: number;
  status: "draft" | "active" | "achieved" | "failed" | "cancelled";
  bestRank: number | null;
} & ({
  kind?: "race_result";
  raceLabel: string;
  raceSlug: string;
  raceEditionId: string;
  categoryCode: RaceCategoryCode;
  targetRank: number;
} | {
  kind: "roster_nationality";
  raceLabel: null;
  raceSlug: null;
  raceEditionId: null;
  categoryCode: null;
  targetRank: null;
  nationalityCountryCode: string;
  nationalityCountryName: string;
  requiredRiderCount: number;
  currentRiderCount: number;
});

export const DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT: SecondarySponsorLogoPlacement = {
  xPercent: 50,
  yPercent: 48,
  scale: 1,
  rotationDegrees: 0,
};

const SECONDARY_REWARD_BY_CATEGORY: Record<RaceCategoryCode, number> = {
  local: 0,
  regional: 0,
  national: 35_000,
  continental: 65_000,
  world: 110_000,
  elite: 160_000,
};

export function getSecondarySponsorObjectiveCount(
  prestige: SponsorPrestige,
): 3 | 4 | 5 {
  if (prestige >= 5) return 5;
  if (prestige >= 3) return 4;
  return 3;
}

export function getSecondarySponsorEligibleCategoryCodes(
  reputationPoints: number,
): readonly RaceCategoryCode[] {
  if (reputationPoints >= 5_000) return ["world", "elite"];
  return ["continental", "world", "elite"];
}

export function getSecondarySponsorTargetRank({
  prestige,
  categoryCode,
  index,
}: {
  prestige: SponsorPrestige;
  categoryCode: RaceCategoryCode;
  index: number;
}): number {
  const categoryAdjustment = categoryCode === "elite" || categoryCode === "world" ? 1 : 0;
  const baseRank = [10, 8, 5, 3, 1][prestige - 1] ?? 10;
  return Math.max(1, baseRank + categoryAdjustment + (index % 2));
}

export function calculateSecondarySponsorObjectiveReward({
  prestige,
  categoryCode,
  targetRank,
  reputationPoints = SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
}: {
  prestige: SponsorPrestige;
  categoryCode: RaceCategoryCode;
  targetRank: number;
  reputationPoints?: number;
}): number {
  const prestigeMultiplier = 0.8 + prestige * 0.1;
  const rankMultiplier = targetRank === 1 ? 1.5 : targetRank <= 3 ? 1.25 : 1;
  const reputationMultiplier = getSecondarySponsorReputationMultiplier(reputationPoints);

  return (
    Math.round(
      (SECONDARY_REWARD_BY_CATEGORY[categoryCode] *
        prestigeMultiplier *
        reputationMultiplier *
        rankMultiplier) /
        1_000,
    ) * 1_000
  );
}

export function getSecondarySponsorReputationMultiplier(reputationPoints: number): number {
  return 1 + Math.min(1, Math.max(0, reputationPoints - SECONDARY_SPONSOR_REPUTATION_THRESHOLD) / 13_500);
}

export function getSecondarySponsorFailurePenalty(cashReward: number): number {
  return cashReward >= 100_000 ? Math.min(25, Math.ceil(cashReward / 100_000) * 5) : 0;
}

export function getSecondarySponsorMaximumReward(principalBudgetPerSeason: number): number {
  if (!Number.isFinite(principalBudgetPerSeason) || principalBudgetPerSeason <= 0) return 0;
  const principalCents = Math.round(principalBudgetPerSeason * 100);
  return Math.floor(principalCents * SECONDARY_SPONSOR_BUDGET_PERCENT / 100) / 100;
}

/** Keeps the whole offer within its budget while preserving the relative objective weights. */
export function capSecondarySponsorObjectiveRewards(
  cashRewards: readonly number[],
  principalBudgetPerSeason: number,
): number[] {
  if (cashRewards.length === 0) return [];
  const weights = cashRewards.map(reward => {
    const cents = Math.round(reward * 100);
    if (!Number.isSafeInteger(cents) || cents < 1) throw new RangeError("Invalid secondary sponsor reward.");
    return cents;
  });
  const maximumCents = Math.round(getSecondarySponsorMaximumReward(principalBudgetPerSeason) * 100);
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= maximumCents) return weights.map(value => value / 100);
  if (maximumCents < weights.length) throw new RangeError("Insufficient primary sponsor budget.");

  // Reserve a cent per objective: the database requires positive rewards.
  const remaining = BigInt(maximumCents - weights.length);
  const denominator = BigInt(total);
  const allocations = weights.map((weight, index) => {
    const numerator = remaining * BigInt(weight);
    return { index, cents: 1 + Number(numerator / denominator), remainder: numerator % denominator };
  });
  const spare = maximumCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const order = [...allocations].sort((first, second) =>
    first.remainder === second.remainder ? first.index - second.index : first.remainder > second.remainder ? -1 : 1);
  for (let index = 0; index < spare; index += 1) order[index].cents += 1;
  return allocations.map(allocation => allocation.cents / 100);
}

export function getSecondarySponsorNationalityTarget({
  rosterSize, prestige, sponsorCountryCode, principalCountryCode,
}: {
  rosterSize: number;
  prestige: SponsorPrestige;
  sponsorCountryCode: string;
  principalCountryCode: string | null;
}): number {
  if (!principalCountryCode || sponsorCountryCode === principalCountryCode) return 0;
  return Math.max(0, Math.min(Math.floor(rosterSize / 10), Math.ceil(prestige / 2), 3));
}

export function calculateSecondarySponsorNationalityReward({
  targetCount, prestige, reputationPoints,
}: { targetCount: number; prestige: SponsorPrestige; reputationPoints: number }): number {
  return Math.round((35_000 + targetCount * 15_000) * (0.8 + prestige * 0.1)
    * getSecondarySponsorReputationMultiplier(reputationPoints) / 1_000) * 1_000;
}

export function normalizeSecondarySponsorLogoPlacement(
  placement: SecondarySponsorLogoPlacement,
): SecondarySponsorLogoPlacement {
  return {
    xPercent: clamp(placement.xPercent, 15, 85),
    yPercent: clamp(placement.yPercent, 20, 78),
    scale: clamp(placement.scale, 0.5, 1.8),
    rotationDegrees: clamp(placement.rotationDegrees, -45, 45),
    ...(placement.colorMode ? { colorMode: ["original", "black", "white"].includes(placement.colorMode) ? placement.colorMode : "original" as const } : {}),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
