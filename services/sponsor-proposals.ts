import { getNeighboringCountryCodes } from "@/data/country-neighbors";
import { SPONSORS } from "@/data/sponsors";
import {
  normalizeFeaturedRiderSponsorAffinity,
  normalizeSponsorCountryCode,
  type FeaturedRiderSponsorAffinity,
} from "@/lib/game/sponsor-nationality-affinity";
import { isSponsorEligibleForReputation } from "@/lib/game/sponsor-prestige";
import {
  getSponsorInitialBudgetBonusPercent,
  resolveSponsorSportingPhilosophy,
  type SponsorSportingPhilosophy,
} from "@/lib/game/sponsor-philosophy";
import type { Sponsor, SponsorProposal } from "@/types/sponsor";

export interface GenerateSponsorProposalsOptions {
  directorCountryCode: string;
  directorReputation: number;
  unavailableSponsorIds?: readonly string[];
  proposalCount?: number;
  featuredRiderAffinity?: FeaturedRiderSponsorAffinity | null;
  random?: () => number;
}

const DEFAULT_PROPOSAL_COUNT = 3;
const BUDGET_STEP = 10_000;


export function generateSponsorProposals({
  directorCountryCode,
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
  const featuredRider = normalizeFeaturedRiderSponsorAffinity(
    featuredRiderAffinity
  );

  const unavailableSponsorIdSet = new Set(
    unavailableSponsorIds
  );

  const eligibleSponsors = SPONSORS.filter(
    (sponsor) =>
      isSponsorEligibleForReputation(sponsor, directorReputation) &&
      !unavailableSponsorIdSet.has(sponsor.id)
  );

  const directorNeighboringCountries = new Set(
    getNeighboringCountryCodes(directorCountry)
  );
  const featuredRiderCountry = featuredRider?.countryCode ?? null;
  const featuredRiderNeighboringCountries = new Set(
    featuredRiderCountry
      ? getNeighboringCountryCodes(featuredRiderCountry)
      : []
  );

  const nationalSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) => sponsor.countryCode === directorCountry
    ),
    random
  );
  const featuredRiderSponsors = shuffleSponsors(
    featuredRiderCountry && featuredRiderCountry !== directorCountry
      ? eligibleSponsors.filter(
          (sponsor) => sponsor.countryCode === featuredRiderCountry
        )
      : [],
    random
  );
  const directorNeighboringSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        directorNeighboringCountries.has(sponsor.countryCode) &&
        sponsor.countryCode !== featuredRiderCountry
    ),
    random
  );
  const featuredRiderNeighboringSponsors = shuffleSponsors(
    featuredRiderCountry
      ? eligibleSponsors.filter(
          (sponsor) =>
            featuredRiderNeighboringCountries.has(sponsor.countryCode) &&
            sponsor.countryCode !== directorCountry &&
            !directorNeighboringCountries.has(sponsor.countryCode)
        )
      : [],
    random
  );
  const fallbackSponsors = shuffleSponsors(
    eligibleSponsors.filter(
      (sponsor) =>
        sponsor.countryCode !== directorCountry &&
        sponsor.countryCode !== featuredRiderCountry &&
        !directorNeighboringCountries.has(sponsor.countryCode) &&
        !featuredRiderNeighboringCountries.has(sponsor.countryCode)
    ),
    random
  );

  const selectedSponsors: Sponsor[] = [];
  const selectedSponsorIds = new Set<string>();
  const selectFromPool = (pool: readonly Sponsor[], maximum = Infinity) => {
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

  if (featuredRiderSponsors.length > 0) {
    selectFromPool(nationalSponsors, 1);
    selectFromPool(featuredRiderSponsors, 1);
  }

  selectFromPool(nationalSponsors);
  selectFromPool(featuredRiderSponsors);
  selectFromPool(directorNeighboringSponsors);
  selectFromPool(featuredRiderNeighboringSponsors);
  selectFromPool(fallbackSponsors);

  return selectedSponsors.map((sponsor) =>
    createSponsorProposal(sponsor, random)
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
