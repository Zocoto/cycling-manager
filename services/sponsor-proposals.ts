import { getNeighboringCountryCodes } from "@/data/country-neighbors";
import { SPONSORS } from "@/data/sponsors";
import type { Sponsor, SponsorProposal } from "@/types/sponsor";

export interface GenerateSponsorProposalsOptions {
  directorCountryCode: string;
  directorReputation: number;
  unavailableSponsorIds?: readonly string[];
  proposalCount?: number;
}

const DEFAULT_PROPOSAL_COUNT = 3;
const BUDGET_STEP = 10_000;

export function generateSponsorProposals({
  directorCountryCode,
  directorReputation,
  unavailableSponsorIds = [],
  proposalCount = DEFAULT_PROPOSAL_COUNT,
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

  const selectedSponsors = [
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