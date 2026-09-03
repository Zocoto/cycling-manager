import type { Sponsor } from "@/types/sponsor";

export const SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS = {
  1: 0,
  2: 30,
  3: 75,
  4: 300,
  5: 750,
} as const satisfies Record<Sponsor["prestige"], number>;

const LEGACY_SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS = {
  1: 0,
  2: 30,
  3: 100,
  4: 500,
  5: 1_000,
} as const satisfies Record<Sponsor["prestige"], number>;

export function getSponsorMinimumReputation(
  sponsor: Pick<Sponsor, "minimumReputation" | "prestige">
): number {
  const configuredMinimum =
    sponsor.minimumReputation ===
    LEGACY_SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS[sponsor.prestige]
      ? SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS[sponsor.prestige]
      : sponsor.minimumReputation;

  return Math.max(
    configuredMinimum,
    SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS[sponsor.prestige]
  );
}

export function isSponsorEligibleForReputation(
  sponsor: Pick<Sponsor, "minimumReputation" | "prestige">,
  reputationPoints: number
): boolean {
  return reputationPoints >= getSponsorMinimumReputation(sponsor);
}
