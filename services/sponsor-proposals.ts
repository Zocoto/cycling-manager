import { getNeighboringCountryCodes } from "@/data/country-neighbors";
import { SPONSORS } from "@/data/sponsors";
import {
  getCombinedInternationalSchoolSponsorContactChance,
  normalizeFeaturedRiderSponsorAffinity,
  normalizeInternationalSchoolSponsorAffinities,
  normalizeSponsorCountryCode,
  type FeaturedRiderSponsorAffinity,
  type InternationalSchoolSponsorAffinity,
} from "@/lib/game/sponsor-nationality-affinity";
import {
  SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS,
  isSponsorEligibleForReputation,
} from "@/lib/game/sponsor-prestige";
import {
  getSponsorInitialBudgetBonusPercent,
  resolveSponsorSportingPhilosophy,
  type SponsorSportingPhilosophy,
} from "@/lib/game/sponsor-philosophy";
import type { Sponsor, SponsorProposal } from "@/types/sponsor";

export interface GenerateSponsorProposalsOptions {
  directorCountryCode?: string;
  teamCountryCode?: string;
  leaderCountryCodes?: readonly string[];
  rosterMajorityCountryCode?: string | null;
  preferredSponsorIds?: readonly string[];
  internationalSchoolAffinities?: readonly InternationalSchoolSponsorAffinity[];
  directorReputation: number;
  unavailableSponsorIds?: readonly string[];
  proposalCount?: number;
  featuredRiderAffinity?: FeaturedRiderSponsorAffinity | null;
  random?: () => number;
}

const DEFAULT_PROPOSAL_COUNT = 3;
const BUDGET_STEP = 10_000;


export function generateSponsorProposals({
  directorCountryCode = "",
  teamCountryCode,
  leaderCountryCodes = [],
  rosterMajorityCountryCode = null,
  preferredSponsorIds = [],
  internationalSchoolAffinities = [],
  directorReputation,
  unavailableSponsorIds = [],
  proposalCount = DEFAULT_PROPOSAL_COUNT,
  featuredRiderAffinity = null,
  random = Math.random,
}: GenerateSponsorProposalsOptions): SponsorProposal[] {
  if (proposalCount <= 0) {
    return [];
  }

  const directorCountry = normalizeSponsorCountryCode(directorCountryCode);
  const primaryCountry = normalizeSponsorCountryCode(
    teamCountryCode ?? directorCountry
  );
  const featuredRider = normalizeFeaturedRiderSponsorAffinity(
    featuredRiderAffinity
  );

  const normalizedLeaderCountries = [
    ...new Set(
      [
        ...leaderCountryCodes,
        ...(featuredRider ? [featuredRider.countryCode] : []),
      ]
        .map(normalizeSponsorCountryCode)
        .filter((countryCode) => countryCode && countryCode !== primaryCountry)
    ),
  ];
  const majorityCountry = rosterMajorityCountryCode
    ? normalizeSponsorCountryCode(rosterMajorityCountryCode)
    : null;
  const schoolAffinities = normalizeInternationalSchoolSponsorAffinities(
    internationalSchoolAffinities,
  ).filter((affinity) => affinity.countryCode !== primaryCountry);
  const affinityCountries = [
    primaryCountry,
    ...normalizedLeaderCountries,
    ...(majorityCountry ? [majorityCountry] : []),
    ...(directorCountry ? [directorCountry] : []),
  ].filter(Boolean);
  const uniqueAffinityCountries = [...new Set(affinityCountries)];

  const unavailableSponsorIdSet = new Set(
    unavailableSponsorIds
  );
  const preferredSponsorIdSet = new Set(preferredSponsorIds);
  const eligibleSponsors = SPONSORS.filter(
    (sponsor) =>
      isSponsorEligibleForReputation(sponsor, directorReputation) &&
      !unavailableSponsorIdSet.has(sponsor.id)
  );

  const nationalBridgeSponsors = primaryCountry
    ? SPONSORS.filter(
        (sponsor) =>
          sponsor.countryCode === primaryCountry &&
          !unavailableSponsorIdSet.has(sponsor.id) &&
          !isSponsorEligibleForReputation(sponsor, directorReputation) &&
          isSponsorEligibleForTeamAffinity({
            sponsor,
            reputationPoints: directorReputation,
            teamCountryCode: primaryCountry,
            rosterMajorityCountryCode: majorityCountry,
          }),
      ).sort(
        (left, right) =>
          left.minimumReputation - right.minimumReputation ||
          left.prestige - right.prestige ||
          left.id.localeCompare(right.id),
      )
    : [];

  const neighboringCountries = new Set(
    uniqueAffinityCountries.flatMap((countryCode) =>
      getNeighboringCountryCodes(countryCode)
    )
  );

  const nationalSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) => sponsor.countryCode === primaryCountry
    ),
    random
  );
  const preferredSponsors = shuffleSponsors(
    eligibleSponsors.filter((sponsor) => preferredSponsorIdSet.has(sponsor.id)),
    random,
  );
  const availableSchoolAffinities = schoolAffinities.flatMap((affinity) => {
    const sponsors = eligibleSponsors.filter(
      (sponsor) => sponsor.countryCode === affinity.countryCode,
    );
    return sponsors.length > 0 ? [{ affinity, sponsors }] : [];
  });
  const contactedSchool = selectInternationalSchoolContact({
    schools: availableSchoolAffinities,
    random,
  });
  const internationalSchoolSponsors = contactedSchool
    ? shuffleSponsors(contactedSchool.sponsors, random)
    : [];
  const affinitySponsorPools = uniqueAffinityCountries
    .filter((countryCode) => countryCode !== primaryCountry)
    .map((countryCode) =>
      shuffleSponsors(
        eligibleSponsors.filter(
          (sponsor) => sponsor.countryCode === countryCode
        ),
        random
      )
    );
  const neighboringSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        neighboringCountries.has(sponsor.countryCode) &&
        !uniqueAffinityCountries.includes(sponsor.countryCode)
    ),
    random
  );
  const fallbackSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        !uniqueAffinityCountries.includes(sponsor.countryCode) &&
        !neighboringCountries.has(sponsor.countryCode)
    ),
    random
  );

  const selectedSponsors: Sponsor[] = [];
  const selectedSponsorIds = new Set<string>();
  const selectFromPool = (pool: readonly Sponsor[], maximum = Infinity) => {
    if (maximum <= 0) return;
    let selectedFromPool = 0;

    for (const sponsor of pool) {
      if (selectedSponsors.length >= proposalCount) return;
      if (selectedSponsorIds.has(sponsor.id)) continue;
      selectedSponsors.push(sponsor);
      selectedSponsorIds.add(sponsor.id);
      selectedFromPool += 1;
      if (selectedFromPool >= maximum) return;
    }
  };

  const nationalPrioritySponsors =
    nationalSponsors.length > 0 ? nationalSponsors : nationalBridgeSponsors;
  if (preferredSponsors.length > 0) {
    const reservedPrioritySlots =
      Number(nationalPrioritySponsors.length > 0) +
      Number(internationalSchoolSponsors.length > 0);
    selectFromPool(
      preferredSponsors,
      Math.max(0, proposalCount - reservedPrioritySlots),
    );
  }

  selectFromPool(nationalPrioritySponsors, 1);
  selectFromPool(internationalSchoolSponsors, 1);

  for (const pool of affinitySponsorPools) {
    selectFromPool(pool, 1);
  }
  selectFromPool(nationalSponsors);
  for (const pool of affinitySponsorPools) {
    selectFromPool(pool);
  }
  selectFromPool(neighboringSponsors);
  selectFromPool(fallbackSponsors);

  return selectedSponsors.map((sponsor) =>
    createSponsorProposal(sponsor, random)
  );
}

function selectInternationalSchoolContact({
  schools,
  random,
}: {
  schools: readonly {
    affinity: InternationalSchoolSponsorAffinity;
    sponsors: readonly Sponsor[];
  }[];
  random: () => number;
}): {
  affinity: InternationalSchoolSponsorAffinity;
  sponsors: readonly Sponsor[];
} | null {
  if (schools.length === 0) return null;

  const contactChance = getCombinedInternationalSchoolSponsorContactChance(
    schools.map((school) => school.affinity),
  );
  if (random() >= contactChance) return null;

  const totalWeight = schools.reduce(
    (sum, school) => sum + school.affinity.qualityLevel,
    0,
  );
  let targetWeight = random() * totalWeight;

  for (const school of schools) {
    targetWeight -= school.affinity.qualityLevel;
    if (targetWeight < 0) return school;
  }

  return schools.at(-1) ?? null;
}

export function isSponsorEligibleForNationalBridgeOffer(
  sponsor: Sponsor,
  reputationPoints: number,
): boolean {
  if (sponsor.prestige <= 1) return false;

  const standardThreshold =
    SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS[sponsor.prestige];
  const previousTier = (sponsor.prestige - 1) as Sponsor["prestige"];
  const bridgeThreshold =
    SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS[previousTier];

  return (
    sponsor.minimumReputation <= standardThreshold &&
    reputationPoints >= bridgeThreshold
  );
}

export function isSponsorEligibleForTeamAffinity({
  sponsor,
  reputationPoints,
  teamCountryCode,
  rosterMajorityCountryCode,
}: {
  sponsor: Sponsor;
  reputationPoints: number;
  teamCountryCode?: string | null;
  rosterMajorityCountryCode?: string | null;
}): boolean {
  if (isSponsorEligibleForReputation(sponsor, reputationPoints)) {
    return true;
  }

  const sponsorCountry = normalizeSponsorCountryCode(sponsor.countryCode);
  const teamCountry = normalizeSponsorCountryCode(teamCountryCode ?? "");
  const majorityCountry = normalizeSponsorCountryCode(
    rosterMajorityCountryCode ?? "",
  );

  return (
    Boolean(sponsorCountry) &&
    sponsorCountry === teamCountry &&
    sponsorCountry === majorityCountry &&
    isSponsorEligibleForNationalBridgeOffer(sponsor, reputationPoints)
  );
}

function createSponsorProposal(
  sponsor: Sponsor,
  random: () => number
): SponsorProposal {
  const sportingPhilosophy = resolveSponsorSportingPhilosophy(sponsor.id);
  const baseBudget = getRandomBudget(
    sponsor.budgetRange.min,
    sponsor.budgetRange.max,
    random
  );

  return {
    sponsor,
    proposedBudget: applySponsorPhilosophyBudgetBonus(
      baseBudget,
      sportingPhilosophy,
    ),
    contractDurationSeasons: getRandomInteger(
      sponsor.contractDurationRange.min,
      sponsor.contractDurationRange.max,
      random
    ),
  };
}

export function applySponsorPhilosophyBudgetBonus(
  baseBudget: number,
  philosophy: SponsorSportingPhilosophy,
): number {
  const bonusPercent = getSponsorInitialBudgetBonusPercent(philosophy);
  const adjustedBudget = baseBudget * (1 + bonusPercent / 100);

  return Math.round(adjustedBudget / BUDGET_STEP) * BUDGET_STEP;
}

function getRandomBudget(
  minimumBudget: number,
  maximumBudget: number,
  random: () => number
): number {
  const minimumStep = Math.ceil(
    minimumBudget / BUDGET_STEP
  );
  const maximumStep = Math.floor(
    maximumBudget / BUDGET_STEP
  );

  return (
    getRandomInteger(minimumStep, maximumStep, random) *
    BUDGET_STEP
  );
}

function getRandomInteger(
  minimum: number,
  maximum: number,
  random: () => number
): number {
  return (
    Math.floor(random() * (maximum - minimum + 1)) +
    minimum
  );
}

function shuffleSponsors(
  sponsors: readonly Sponsor[],
  random: () => number
): Sponsor[] {
  const shuffledSponsors = [...sponsors];

  for (
    let index = shuffledSponsors.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      random() * (index + 1)
    );

    [
      shuffledSponsors[index],
      shuffledSponsors[randomIndex],
    ] = [
      shuffledSponsors[randomIndex],
      shuffledSponsors[index],
    ];
  }

  return shuffledSponsors;
}
