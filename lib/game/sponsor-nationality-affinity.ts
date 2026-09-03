export type FeaturedRiderSponsorAffinity = {
  countryCode: string;
  uciPoints: number;
};

export type TeamSponsorCountryAffinity = {
  teamCountryCode: string;
  leaderCountryCodes: readonly string[];
  rosterMajorityCountryCode: string | null;
};

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
