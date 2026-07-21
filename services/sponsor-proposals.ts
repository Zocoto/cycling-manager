import { getNeighboringCountryCodes } from "@/data/country-neighbors";
import { SPONSORS } from "@/data/sponsors";
import {
  getSponsorCountryProposalWeight,
  type RiderCountrySponsorAffinity,
} from "@/lib/game/sponsor-nationality-affinity";
import type { Sponsor, SponsorProposal } from "@/types/sponsor";

export interface GenerateSponsorProposalsOptions {
  directorCountryCode: string;
  directorReputation: number;
  unavailableSponsorIds?: readonly string[];
  proposalCount?: number;
  riderCountryAffinities?: readonly RiderCountrySponsorAffinity[];
  random?: () => number;
}

const DEFAULT_PROPOSAL_COUNT = 3;
const BUDGET_STEP = 10_000;

export function generateSponsorProposals({
  directorCountryCode,
  directorReputation,
  unavailableSponsorIds = [],
  proposalCount = DEFAULT_PROPOSAL_COUNT,
  riderCountryAffinities = [],
  random = Math.random,
}: GenerateSponsorProposalsOptions): SponsorProposal[] {
  if (proposalCount <= 0) {
    return [];
  }

  const normalizedCountryCode = directorCountryCode
    .trim()
    .toUpperCase();

  const unavailableSponsorIdSet = new Set(
    unavailableSponsorIds
  );

  const eligibleSponsors = SPONSORS.filter(
    (sponsor) =>
      sponsor.minimumReputation <= directorReputation &&
      !unavailableSponsorIdSet.has(sponsor.id)
  );

  const neighboringCountryCodes = new Set(
    getNeighboringCountryCodes(normalizedCountryCode)
  );

  const nationalSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        sponsor.countryCode === normalizedCountryCode
    )
  );

  const neighboringSponsors = shuffleSponsors(
    eligibleSponsors.filter((sponsor) =>
      neighboringCountryCodes.has(sponsor.countryCode)
    )
  );

  const internationalSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        sponsor.countryCode !== normalizedCountryCode &&
        !neighboringCountryCodes.has(sponsor.countryCode)
    )
  );

  const hasForeignRosterAffinity = riderCountryAffinities.some(
    (affinity) =>
      affinity.countryCode.trim().toUpperCase() !== normalizedCountryCode &&
      affinity.affinityPoints > 0
  );
  const selectedSponsors = hasForeignRosterAffinity
    ? weightedShuffleSponsors({
        sponsors: eligibleSponsors,
        random,
        getWeight: (sponsor) =>
          getSponsorCountryProposalWeight({
            sponsorCountryCode: sponsor.countryCode,
            teamCountryCode: normalizedCountryCode,
            neighboringCountryCodes,
            riderCountryAffinities,
          }),
      }).slice(0, proposalCount)
    : [
        ...nationalSponsors,
        ...neighboringSponsors,
        ...internationalSponsors,
      ].slice(0, proposalCount);

  return selectedSponsors.map(createSponsorProposal);
}

function createSponsorProposal(
  sponsor: Sponsor
): SponsorProposal {
  return {
    sponsor,
    proposedBudget: getRandomBudget(
      sponsor.budgetRange.min,
      sponsor.budgetRange.max
    ),
    contractDurationSeasons: getRandomInteger(
      sponsor.contractDurationRange.min,
      sponsor.contractDurationRange.max
    ),
  };
}

function getRandomBudget(
  minimumBudget: number,
  maximumBudget: number
): number {
  const minimumStep = Math.ceil(
    minimumBudget / BUDGET_STEP
  );
  const maximumStep = Math.floor(
    maximumBudget / BUDGET_STEP
  );

  return (
    getRandomInteger(minimumStep, maximumStep) *
    BUDGET_STEP
  );
}

function getRandomInteger(
  minimum: number,
  maximum: number
): number {
  return (
    Math.floor(Math.random() * (maximum - minimum + 1)) +
    minimum
  );
}

function shuffleSponsors(
  sponsors: readonly Sponsor[]
): Sponsor[] {
  const shuffledSponsors = [...sponsors];

  for (
    let index = shuffledSponsors.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
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

function weightedShuffleSponsors({
  sponsors,
  random,
  getWeight,
}: {
  sponsors: readonly Sponsor[];
  random: () => number;
  getWeight: (sponsor: Sponsor) => number;
}) {
  return sponsors
    .map((sponsor) => {
      const sample = Math.min(
        1 - Number.EPSILON,
        Math.max(Number.EPSILON, random())
      );
      return {
        sponsor,
        priorityKey: -Math.log(sample) / Math.max(0.01, getWeight(sponsor)),
      };
    })
    .sort(
      (left, right) =>
        left.priorityKey - right.priorityKey ||
        left.sponsor.id.localeCompare(right.sponsor.id)
    )
    .map((entry) => entry.sponsor);
}
