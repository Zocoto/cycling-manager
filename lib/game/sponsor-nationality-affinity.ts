export type FeaturedRiderSponsorAffinity = {
  countryCode: string;
  uciPoints: number;
};

export type InternationalSchoolSponsorAffinity = {
  countryCode: string;
  qualityLevel: number;
};

export type TeamSponsorCountryAffinity = {
  teamCountryCode: string;
  leaderCountryCodes: readonly string[];
  rosterMajorityCountryCode: string | null;
  preferredSponsorIds: readonly string[];
  internationalSchoolAffinities: readonly InternationalSchoolSponsorAffinity[];
};

const INTERNATIONAL_SCHOOL_CONTACT_CHANCE_BY_LEVEL = [
  0,
  0.3,
  0.4,
  0.5,
  0.6,
  0.7,
] as const;

export const MAX_COMBINED_INTERNATIONAL_SCHOOL_CONTACT_CHANCE = 0.85;

export function normalizeSponsorCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

export function normalizeFeaturedRiderSponsorAffinity(
  affinity: FeaturedRiderSponsorAffinity | null | undefined
): FeaturedRiderSponsorAffinity | null {
  if (!affinity || affinity.uciPoints <= 0) return null;

  const countryCode = normalizeSponsorCountryCode(affinity.countryCode);
  if (!countryCode) return null;

  return {
    countryCode,
    uciPoints: affinity.uciPoints,
  };
}

export function normalizeInternationalSchoolSponsorAffinities(
  affinities: readonly InternationalSchoolSponsorAffinity[],
): InternationalSchoolSponsorAffinity[] {
  const highestLevelByCountry = new Map<string, number>();

  for (const affinity of affinities) {
    const countryCode = normalizeSponsorCountryCode(affinity.countryCode);
    if (
      !countryCode ||
      !Number.isFinite(affinity.qualityLevel) ||
      affinity.qualityLevel <= 0
    ) {
      continue;
    }

    const qualityLevel = Math.min(
      5,
      Math.max(1, Math.floor(affinity.qualityLevel)),
    );
    highestLevelByCountry.set(
      countryCode,
      Math.max(highestLevelByCountry.get(countryCode) ?? 0, qualityLevel),
    );
  }

  return [...highestLevelByCountry.entries()]
    .sort(([firstCountry], [secondCountry]) =>
      firstCountry.localeCompare(secondCountry),
    )
    .map(([countryCode, qualityLevel]) => ({ countryCode, qualityLevel }));
}

export function getInternationalSchoolSponsorContactChance(
  qualityLevel: number,
): number {
  if (!Number.isFinite(qualityLevel) || qualityLevel <= 0) return 0;
  const normalizedLevel = Math.min(5, Math.max(1, Math.floor(qualityLevel)));
  return INTERNATIONAL_SCHOOL_CONTACT_CHANCE_BY_LEVEL[normalizedLevel];
}

export function getCombinedInternationalSchoolSponsorContactChance(
  affinities: readonly InternationalSchoolSponsorAffinity[],
): number {
  const normalizedAffinities = normalizeInternationalSchoolSponsorAffinities(
    affinities,
  );
  const combinedChance = 1 - normalizedAffinities.reduce(
    (missChance, affinity) =>
      missChance *
      (1 - getInternationalSchoolSponsorContactChance(affinity.qualityLevel)),
    1,
  );

  return Math.min(
    MAX_COMBINED_INTERNATIONAL_SCHOOL_CONTACT_CHANCE,
    combinedChance,
  );
}
