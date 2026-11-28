import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import type { SponsorPrestige } from "@/types/sponsor";
import { stableHash } from "@/lib/game/sponsor-main-objective";

export const SECONDARY_SPONSOR_REPUTATION_THRESHOLD = 1_500;
export const SECONDARY_SPONSOR_START_GAME_YEAR = 4;
export const SECONDARY_SPONSOR_OFFER_COUNT = 3;
export const SECONDARY_SPONSOR_GENERATION_VERSION = 4;
// Identity and calendar choices survive a pricing-only version change.
export const SECONDARY_SPONSOR_PLAN_VERSION = 3;
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
  logoPath?: string;
  logoBackgroundColor?: string;
  sector?: string;
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
  fundingProfile = 1,
}: {
  prestige: SponsorPrestige;
  categoryCode: RaceCategoryCode;
  index: number;
  fundingProfile?: SecondarySponsorFundingProfile;
}): number {
  const categoryAdjustment = categoryCode === "elite" || categoryCode === "world" ? 1 : 0;
  const baseRank = [10, 8, 5, 3, 1][prestige - 1] ?? 10;
  return Math.max(1, baseRank + categoryAdjustment + (index % 2) + [2, 0, -1][fundingProfile]);
}

export type SecondarySponsorFundingProfile = 0 | 1 | 2;
export type SecondarySponsorRewardWeight = { weight: number; difficulty: number };

/** Financial appetite is stable for this negotiation, independent of objective pricing. */
export function getSecondarySponsorFundingProfiles(seed: string, sponsorIds: readonly string[]): Map<string, SecondarySponsorFundingProfile> {
  if (sponsorIds.length !== 3 || new Set(sponsorIds).size !== 3) throw new RangeError("Three distinct secondary sponsors are required.");
  return new Map([...sponsorIds].sort((first, second) => pricingFraction(`${seed}:appetite:${first}`)
    - pricingFraction(`${seed}:appetite:${second}`) || first.localeCompare(second))
    .map((id, index) => [id, index as SecondarySponsorFundingProfile]));
}

/** Sporting demand affects the quote as well as each objective's share of it. */
export function getSecondarySponsorObjectiveDifficulty({ categoryCode, targetRank, raceFormat = "one_day", isGrandTour = false, isMonument = false }: {
  categoryCode: RaceCategoryCode; targetRank: number; raceFormat?: "one_day" | "stage_race";
  isGrandTour?: boolean; isMonument?: boolean;
}): number {
  const category = { local: 0.4, regional: 0.5, national: 0.7, continental: 0.9, world: 1.15, elite: 1.4 }[categoryCode];
  const rank = 1 + 0.6 * (20 - Math.min(20, Math.max(1, targetRank))) / 19;
  const format = isGrandTour ? 1.35 : raceFormat === "stage_race" ? 1.15 : isMonument ? 1.15 : 1;
  return category * rank * format;
}

/**
 * Thirty percent is a population reference, never an offer ceiling. Independent
 * sponsor signatures and sporting demands vary each quote within disjoint
 * financing bands; a small share of negotiations receives one exceptional bid.
 */
export function priceSecondarySponsorOffers({ principalBudgetPerSeason, seed, offers }: {
  principalBudgetPerSeason: number; seed: string;
  offers: readonly { id: string; objectives: readonly SecondarySponsorRewardWeight[] }[];
}): number[][] {
  const principalCents = Math.round(principalBudgetPerSeason * 100);
  if (!Number.isSafeInteger(principalCents) || principalCents < 1) throw new RangeError("Invalid primary sponsor budget.");
  const profiles = getSecondarySponsorFundingProfiles(seed, offers.map(offer => offer.id));
  const weights = offers.map(offer => {
    if (!offer.objectives.length) throw new RangeError("Secondary sponsor objectives are required.");
    return offer.objectives.map(objective => {
      const cents = Math.round(objective.weight * 100);
      if (!Number.isSafeInteger(cents) || cents < 1 || !Number.isFinite(objective.difficulty) || objective.difficulty <= 0) {
        throw new RangeError("Invalid secondary sponsor reward weight.");
      }
      return cents;
    });
  });
  // The existing SQL contract limits a single objective to €5m. Only implausibly
  // large primary budgets need this reference adjustment; the three bids still
  // retain their separate bands instead of all saturating at the same total.
  const referenceCents = Math.min(principalCents, ...weights.map(values =>
    Math.floor(500_000_000 * (values.reduce((sum, value) => sum + value, 0) / Math.max(...values)) / 0.75)));
  const rare = pricingFraction(`${seed}:exceptional-bid`);
  const minimum = Math.max(...weights.map(values => values.length));
  const quoteByProfile = new Map<SecondarySponsorFundingProfile, number>();
  const quoted = offers.map(offer => {
    const profile = profiles.get(offer.id)!;
    const demand = offer.objectives.reduce((sum, objective) => sum + objective.difficulty, 0) / offer.objectives.length
      * (0.8 + offer.objectives.length * 0.05);
    const demandShare = demand / (1 + demand);
    const signature = pricingFraction(`${seed}:signature:${offer.id}`);
    const share = rare < 0.075 && profile === 0 ? 0.07 + signature * 0.03 + demandShare * 0.02
      : rare >= 0.075 && rare < 0.15 && profile === 2 ? 0.56 + signature * 0.07 + demandShare * 0.11
      : [0.14, 0.27, 0.4][profile] + signature * 0.015 + demandShare * 0.06;
    const rawCents = referenceCents * share;
    const cents = referenceCents >= 10_000_000 ? Math.round(rawCents / 100_000) * 100_000 : Math.round(rawCents);
    return { profile, cents };
  }).sort((first, second) => first.profile - second.profile);
  const minimumGap = Math.max(1, Math.round(referenceCents * 0.05));
  for (const quote of quoted) {
    const previous = quoteByProfile.get((quote.profile - 1) as SecondarySponsorFundingProfile);
    quoteByProfile.set(quote.profile, Math.max(quote.cents, previous === undefined ? minimum : previous + minimumGap));
  }
  return offers.map((offer, index) => allocateSecondarySponsorRewards(weights[index], quoteByProfile.get(profiles.get(offer.id)!)!));
}

function pricingFraction(seed: string): number {
  // Avalanche the stable hash so adjacent season/brand identifiers do not get
  // correlated financial signatures or exceptional-offer draws.
  let value = stableHash(seed);
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
  return ((value ^ value >>> 16) >>> 0) / 4_294_967_296;
}

function allocateSecondarySponsorRewards(weights: readonly number[], totalCents: number): number[] {
  const remaining = BigInt(totalCents - weights.length);
  const denominator = weights.reduce((sum, value) => sum + BigInt(value), BigInt(0));
  const allocations = weights.map((weight, index) => {
    const numerator = remaining * BigInt(weight);
    return { index, cents: 1 + Number(numerator / denominator), remainder: numerator % denominator };
  });
  const spare = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const order = [...allocations].sort((first, second) => first.remainder === second.remainder
    ? first.index - second.index : first.remainder > second.remainder ? -1 : 1);
  for (let index = 0; index < spare; index++) order[index].cents++;
  return allocations.map(allocation => allocation.cents / 100);
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
