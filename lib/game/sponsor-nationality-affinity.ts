export type RiderSponsorNationalityProfile = {
  countryCode: string;
  overall: number;
};

export type RiderCountrySponsorAffinity = {
  countryCode: string;
  riderCount: number;
  topOverall: number;
  affinityPoints: number;
};

const TEAM_COUNTRY_WEIGHT = 12;
const NEIGHBORING_COUNTRY_WEIGHT = 4;
const INTERNATIONAL_COUNTRY_WEIGHT = 1;
const ROSTER_AFFINITY_MULTIPLIER = 4;

export function buildRiderCountrySponsorAffinities(
  riders: readonly RiderSponsorNationalityProfile[]
): RiderCountrySponsorAffinity[] {
  const affinityByCountryCode = new Map<string, RiderCountrySponsorAffinity>();

  for (const rider of riders) {
    const countryCode = rider.countryCode.trim().toUpperCase();
    if (!countryCode) continue;
    const overall = clamp(rider.overall, 0, 100);
    const current = affinityByCountryCode.get(countryCode) ?? {
      countryCode,
      riderCount: 0,
      topOverall: 0,
      affinityPoints: 0,
    };
    current.riderCount += 1;
    current.topOverall = Math.max(current.topOverall, overall);
    current.affinityPoints += getRiderAffinityContribution(overall);
    affinityByCountryCode.set(countryCode, current);
  }

  return [...affinityByCountryCode.values()]
    .map((affinity) => ({
      ...affinity,
      affinityPoints: round(affinity.affinityPoints),
      topOverall: round(affinity.topOverall),
    }))
    .sort(
      (left, right) =>
        right.affinityPoints - left.affinityPoints ||
        right.topOverall - left.topOverall ||
        left.countryCode.localeCompare(right.countryCode)
    );
}

export function getSponsorCountryProposalWeight({
  sponsorCountryCode,
  teamCountryCode,
  neighboringCountryCodes,
  riderCountryAffinities,
}: {
  sponsorCountryCode: string;
  teamCountryCode: string;
  neighboringCountryCodes: ReadonlySet<string>;
  riderCountryAffinities: readonly RiderCountrySponsorAffinity[];
}): number {
  const sponsorCountry = sponsorCountryCode.trim().toUpperCase();
  const teamCountry = teamCountryCode.trim().toUpperCase();

  if (sponsorCountry === teamCountry) return TEAM_COUNTRY_WEIGHT;

  const geographicWeight = neighboringCountryCodes.has(sponsorCountry)
    ? NEIGHBORING_COUNTRY_WEIGHT
    : INTERNATIONAL_COUNTRY_WEIGHT;
  const rosterAffinity = riderCountryAffinities.find(
    (affinity) => affinity.countryCode === sponsorCountry
  );

  return (
    geographicWeight +
    (rosterAffinity?.affinityPoints ?? 0) * ROSTER_AFFINITY_MULTIPLIER
  );
}

export function calculateOverallRating(
  ratings: readonly number[]
): number {
  if (ratings.length === 0) return 0;
  return round(
    ratings.reduce((total, rating) => total + Number(rating), 0) /
      ratings.length
  );
}

function getRiderAffinityContribution(overall: number) {
  return clamp(0.4 + (overall - 45) / 15, 0.25, 3);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
