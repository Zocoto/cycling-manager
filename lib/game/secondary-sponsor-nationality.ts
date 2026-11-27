import { getNeighboringCountryCodes } from "@/data/country-neighbors";
import {
  getCombinedInternationalSchoolSponsorContactChance,
  normalizeInternationalSchoolSponsorAffinities,
  normalizeSponsorCountryCode,
  type TeamSponsorCountryAffinity,
} from "@/lib/game/sponsor-nationality-affinity";
import { stableHash } from "@/lib/game/sponsor-main-objective";

type SecondarySponsorCountryOptions = {
  affinity: TeamSponsorCountryAffinity;
  seed: string;
  availableCountryCodes: readonly string[];
  count?: number;
};

/** Country slots follow primary-sponsor affinities; only the team's country repeats. */
export function selectSecondarySponsorCountryCodes({
  affinity,
  seed,
  availableCountryCodes,
  count = 3,
}: SecondarySponsorCountryOptions): string[] {
  const maximum = Number.isFinite(count) ? Math.max(0, Math.min(3, Math.floor(count))) : 3;
  if (maximum === 0) return [];

  const available = new Set(availableCountryCodes.map(normalizeSponsorCountryCode).filter(Boolean));
  const teamCountry = normalizeSponsorCountryCode(affinity.teamCountryCode || affinity.directorCountryCode);
  const directorCountry = normalizeSponsorCountryCode(affinity.directorCountryCode);
  const selected: string[] = [];
  const addDistinct = (country: string | null | undefined) => {
    const code = country ? normalizeSponsorCountryCode(country) : "";
    if (selected.length < maximum && available.has(code) && !selected.includes(code)) selected.push(code);
  };

  addDistinct(teamCountry);
  if (directorCountry !== teamCountry) addDistinct(directorCountry);

  const schools = normalizeInternationalSchoolSponsorAffinities(affinity.internationalSchoolAffinities)
    .filter(school => school.countryCode !== teamCountry && available.has(school.countryCode));
  const random = createCountryRandom(seed);
  if (schools.length > 0 && random() < getCombinedInternationalSchoolSponsorContactChance(schools)) {
    let weight = random() * schools.reduce((sum, school) => sum + school.qualityLevel, 0);
    for (const school of schools) {
      weight -= school.qualityLevel;
      if (weight < 0) {
        addDistinct(school.countryCode);
        break;
      }
    }
  }

  for (const code of affinity.leaderCountryCodes) addDistinct(code);
  addDistinct(affinity.rosterMajorityCountryCode);

  if (available.has(teamCountry)) {
    while (selected.length < maximum) selected.push(teamCountry);
  }

  // A missing national catalogue must not prevent the other relevant countries appearing.
  const neighboringCountries = new Set([
    teamCountry, directorCountry, ...affinity.leaderCountryCodes,
    ...(affinity.rosterMajorityCountryCode ? [affinity.rosterMajorityCountryCode] : []),
  ].flatMap(code => getNeighboringCountryCodes(normalizeSponsorCountryCode(code))));
  const fallbackCountries = [...available].sort((first, second) =>
    Number(neighboringCountries.has(second)) - Number(neighboringCountries.has(first)) ||
    stableHash(`${seed}:${first}`) - stableHash(`${seed}:${second}`) || first.localeCompare(second));
  for (const code of fallbackCountries) addDistinct(code);

  return selected;
}

function createCountryRandom(seed: string) {
  let state = stableHash(seed) >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
