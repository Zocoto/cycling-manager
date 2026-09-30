import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import type { SponsorPrestige } from "@/types/sponsor";

export const SECONDARY_SPONSOR_REPUTATION_THRESHOLD = 1_500;
export const SECONDARY_SPONSOR_START_GAME_YEAR = 4;
export const SECONDARY_SPONSOR_OFFER_COUNT = 3;

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
};

export type SecondarySponsorObjective = {
  id: string;
  name: string;
  raceLabel: string;
  raceSlug: string;
  categoryCode: RaceCategoryCode;
  targetRank: number;
  cashReward: number;
  status: "draft" | "active" | "achieved" | "failed" | "cancelled";
  bestRank: number | null;
};

export const DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT: SecondarySponsorLogoPlacement = {
  xPercent: 50,
  yPercent: 48,
  scale: 1,
  rotationDegrees: 0,
};

const SECONDARY_REWARD_BY_CATEGORY: Record<RaceCategoryCode, number> = {
  local: 8_000,
  regional: 8_000,
  national: 15_000,
  continental: 25_000,
  world: 40_000,
  elite: 55_000,
};

export function getSecondarySponsorObjectiveCount(
  prestige: SponsorPrestige,
): 3 | 4 | 5 {
  if (prestige >= 5) return 5;
  if (prestige >= 3) return 4;
  return 3;
}

export function getSecondarySponsorEligibleCategoryCodes(
  prestige: SponsorPrestige,
): readonly RaceCategoryCode[] {
  if (prestige >= 4) return ["continental", "world", "elite"];
  if (prestige >= 3) return ["national", "continental", "world"];
  return ["national", "continental"];
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
}: {
  prestige: SponsorPrestige;
  categoryCode: RaceCategoryCode;
  targetRank: number;
}): number {
  const prestigeMultiplier = 0.75 + prestige * 0.08;
  const rankMultiplier = targetRank === 1 ? 1.25 : targetRank <= 3 ? 1.12 : 1;

  return (
    Math.round(
      (SECONDARY_REWARD_BY_CATEGORY[categoryCode] *
        prestigeMultiplier *
        rankMultiplier) /
        1_000,
    ) * 1_000
  );
}

export function normalizeSecondarySponsorLogoPlacement(
  placement: SecondarySponsorLogoPlacement,
): SecondarySponsorLogoPlacement {
  return {
    xPercent: clamp(placement.xPercent, 15, 85),
    yPercent: clamp(placement.yPercent, 20, 78),
    scale: clamp(placement.scale, 0.5, 1.8),
    rotationDegrees: clamp(placement.rotationDegrees, -45, 45),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
