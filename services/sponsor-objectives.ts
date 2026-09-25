import type {
  GeneratedSponsorObjective,
  SponsorObjectiveAmbitionLevel,
  SponsorObjectivePriority,
  SponsorObjectiveTargetDetails,
} from "@/types/sponsor-objective";
import type {
  SponsorPrestige,
} from "@/types/sponsor";
import {
  getRaceCategoryReputationThreshold,
  type RaceCategoryCode,
  type RaceProfileType,
} from "@/lib/game/race-calendar";
import {
  resolveSponsorSportingPhilosophy,
  type SponsorSportingPhilosophy,
} from "@/lib/game/sponsor-philosophy";
import {
  adjustSponsorObjectiveAmbitionLevel,
  type SponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";
import type {
  RiderRatings,
  RiderSportingProfile,
  RiderSpecialtyProfile,
} from "@/lib/game/rider-profile";

const OBJECTIVE_COUNT = 10;
const SPONSOR_OBJECTIVE_GENERATION_VERSION = 10;
export const SPONSOR_OBJECTIVE_PRESTIGE_CATEGORY_POLICY_START_GAME_YEAR = 4;

const SPONSOR_OBJECTIVE_CATEGORY_PRIORITY_BY_PRESTIGE: Record<
  SponsorPrestige,
  readonly (readonly RaceCategoryCode[])[]
> = {
  1: [["national"], ["continental"], ["world"], ["elite"]],
  2: [["national", "continental"], ["world"], ["elite"]],
  3: [["continental"], ["world", "national"], ["elite"]],
  4: [["world", "continental"], ["elite"], ["national"]],
  5: [["elite", "world"], ["continental"], ["national"]],
};

export type SponsorObjectiveRaceCandidate = {
  raceId: string;
  raceEditionId: string | null;
  raceSlug: string;
  raceLabel: string;
  countryCode: string;
  continentCode?: string | null;
  registrationPolicy: "open" | "criteria_pending" | "closed";
  minimumReputation: number | null;
  categoryCode?: RaceCategoryCode;
  raceFormat?: "one_day" | "stage_race";
  profileTypes?: readonly RaceProfileType[];
  competitionType?: string;
  isMonument?: boolean;
  isGrandTour?: boolean;
};

export type SponsorObjectiveRiderCandidate = {
  riderId: string;
  riderName: string;
  countryCode: string;
  sportingProfile: RiderSportingProfile;
  overallRating: number;
  ratings: RiderRatings;
};

export type SponsorObjectiveTeamRiderCandidate =
  SponsorObjectiveRiderCandidate & {
    joinedForTargetSeason: boolean;
  };

type SponsorLeaderDomain = NonNullable<
  SponsorObjectiveTargetDetails["leaderDomain"]
>;

type GenerateSponsorObjectivesOptions = {
  sponsorCountryCode: string;
  sponsorPrestige: SponsorPrestige;
  proposedBudget: number;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  sponsorCatalogKey?: string;
  sponsorSector?: string;
  sponsorContinentCode?: string | null;
  sportingPhilosophy?: SponsorSportingPhilosophy;
  relationshipYear?: number;
  objectiveDifficulty?: SponsorObjectiveDifficulty;
  riderCandidates?: readonly SponsorObjectiveRiderCandidate[];
  teamRiderCandidates?: readonly SponsorObjectiveTeamRiderCandidate[];
  previousObjectives?: readonly SponsorObjectiveTargetDetails[];
  includeRiderRecruitmentObjective?: boolean;
  targetSeasonGameYear?: number;
  random?: () => number;
};

type ObjectiveWithoutDisplayOrder = Omit<
  GeneratedSponsorObjective,
  "displayOrder"
>;

export type SponsorObjectiveFocus =
  | "national_identity"
  | "territorial_races"
  | "sporting_performance"
  | "talent_development"
  | "prestige";

type SponsorObjectiveWeightKey =
  | "domesticRace"
  | "regionalRace"
  | "nationality"
  | "seasonWins"
  | "specialtyWins"
  | "teamRanking"
  | "nationRanking"
  | "nationalChampionship"
  | "ambition"
  | "legacy";

const SATISFACTION_WEIGHTS: Record<
  SponsorObjectiveFocus,
  Record<SponsorObjectiveWeightKey, number>
> = {
  national_identity: {
    domesticRace: 14,
    regionalRace: 6,
    nationality: 18,
    seasonWins: 10,
    specialtyWins: 7,
    teamRanking: 10,
    nationRanking: 10,
    nationalChampionship: 14,
    ambition: 7,
    legacy: 4,
  },
  territorial_races: {
    domesticRace: 20, regionalRace: 10, nationality: 10, seasonWins: 10,
    specialtyWins: 7, teamRanking: 10, nationRanking: 8,
    nationalChampionship: 14, ambition: 7, legacy: 4,
  },
  sporting_performance: {
    domesticRace: 10, regionalRace: 6, nationality: 7, seasonWins: 15,
    specialtyWins: 10, teamRanking: 18, nationRanking: 8,
    nationalChampionship: 8, ambition: 12, legacy: 6,
  },
  talent_development: {
    domesticRace: 8, regionalRace: 6, nationality: 10, seasonWins: 10,
    specialtyWins: 8, teamRanking: 12, nationRanking: 8,
    nationalChampionship: 8, ambition: 20, legacy: 10,
  },
  prestige: {
    domesticRace: 8, regionalRace: 5, nationality: 5, seasonWins: 10,
    specialtyWins: 7, teamRanking: 15, nationRanking: 5,
    nationalChampionship: 8, ambition: 17, legacy: 20,
  },
};

const NATIONAL_PREFERENCE_SATISFACTION_WEIGHTS: Record<
  SponsorObjectiveWeightKey,
  number
> = {
  domesticRace: 14,
  regionalRace: 4,
  nationality: 30,
  seasonWins: 8,
  specialtyWins: 5,
  teamRanking: 8,
  nationRanking: 12,
  nationalChampionship: 12,
  ambition: 5,
  legacy: 2,
};

const SPONSOR_COUNTRY_NEIGHBORS: Readonly<Record<string, readonly string[]>> = {
  AM: ["GE", "TR", "AZ"],
  AR: ["BR", "CL", "UY", "PY", "BO"],
  AT: ["DE", "CH", "IT", "SI", "CZ", "SK", "HU"],
  BE: ["FR", "NL", "DE", "LU"],
  BR: ["AR", "UY", "PY", "BO", "PE", "CO", "VE"],
  BW: ["ZA", "NA", "ZW", "ZM"],
  CA: ["US"],
  CH: ["FR", "DE", "AT", "IT"],
  CI: ["GH", "BF", "ML", "GN", "LR"],
  CL: ["AR", "BO", "PE"],
  CM: ["NG", "TD", "CF", "CG", "GA"],
  CN: ["KR", "MN", "KZ", "IN", "NP"],
  CO: ["VE", "BR", "PE", "EC", "PA"],
  CY: ["GR", "TR"],
  CZ: ["DE", "PL", "SK", "AT"],
  DE: ["DK", "PL", "CZ", "AT", "CH", "FR", "BE", "NL"],
  DK: ["DE", "SE", "NO"],
  EE: ["LV", "FI"],
  ES: ["PT", "FR", "MA"],
  ET: ["KE", "SD", "SS", "SO", "DJ", "ER"],
  FI: ["SE", "NO", "EE"],
  FJ: ["NZ", "AU"],
  FR: ["BE", "LU", "DE", "CH", "IT", "ES", "GB"],
  GB: ["IE", "FR", "BE", "NL"],
  GE: ["TR", "AM", "AZ"],
  GR: ["TR", "BG", "AL", "CY"],
  HR: ["SI", "HU", "RS", "BA", "ME", "IT"],
  ID: ["MY", "PH", "SG"],
  IN: ["PK", "CN", "NP", "BD", "LK"],
  IT: ["FR", "CH", "AT", "SI", "HR"],
  JP: ["KR", "CN"],
  JM: ["US", "MX"],
  KE: ["ET", "UG", "TZ", "SO", "SS"],
  KR: ["CN", "JP"],
  KZ: ["CN", "MN", "KG", "UZ"],
  LB: ["TR", "CY"],
  LT: ["LV", "PL"],
  LV: ["EE", "LT"],
  MA: ["ES", "PT", "DZ"],
  MG: ["MU", "ZA"],
  MU: ["MG", "ZA"],
  MX: ["US"],
  MN: ["CN", "KZ", "KR"],
  MV: ["IN", "LK"],
  NA: ["ZA", "BW", "AO", "ZM"],
  NG: ["CM", "BJ", "NE", "TD"],
  NL: ["BE", "DE"],
  NP: ["IN", "CN"],
  NZ: ["AU", "FJ"],
  PE: ["BR", "CO", "CL", "BO", "EC"],
  PH: ["ID", "MY", "SG"],
  PK: ["IN", "CN"],
  PL: ["DE", "CZ", "SK", "LT"],
  PT: ["ES", "MA"],
  RW: ["UG", "TZ", "BI", "CD"],
  SE: ["NO", "FI", "DK"],
  SG: ["MY", "ID"],
  SI: ["IT", "AT", "HU", "HR"],
  SN: ["MA", "MR", "ML", "GN"],
  TH: ["MY", "LA", "KH", "MM"],
  TR: ["GR", "BG", "GE", "AM", "CY"],
  US: ["CA", "MX"],
  UY: ["BR", "AR"],
  VE: ["CO", "BR"],
  ZA: ["NA", "BW", "ZW", "MZ"],
};

export function generateProvisionalSponsorObjectives({
  sponsorCountryCode,
  sponsorPrestige,
  proposedBudget,
  teamReputationPoints,
  raceCandidates,
  sponsorCatalogKey = "",
  sponsorSector = "",
  sponsorContinentCode = null,
  sportingPhilosophy: requestedSportingPhilosophy,
  relationshipYear = 1,
  objectiveDifficulty = "balanced",
  riderCandidates = [],
  teamRiderCandidates = [],
  previousObjectives = [],
  includeRiderRecruitmentObjective = false,
  targetSeasonGameYear =
    SPONSOR_OBJECTIVE_PRESTIGE_CATEGORY_POLICY_START_GAME_YEAR - 1,
  random = Math.random,
}: GenerateSponsorObjectivesOptions): GeneratedSponsorObjective[] {
  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();

  if (!normalizedCountryCode) {
    throw new Error(
      "Le code pays du sponsor est obligatoire pour générer ses objectifs."
    );
  }

  const focus = resolveSponsorObjectiveFocus({
    sponsorCatalogKey,
    sponsorSector,
    sponsorPrestige,
  });
  const sportingPhilosophy =
    requestedSportingPhilosophy ??
    resolveSponsorSportingPhilosophy(
      sponsorCatalogKey || normalizedCountryCode,
    );
  const ambitionLevel = adjustSponsorObjectiveAmbitionLevel(
    resolveSponsorObjectiveAmbitionLevel({
      sponsorPrestige,
      proposedBudget,
    }),
    objectiveDifficulty,
  );
  const weights = sportingPhilosophy === "national_preference"
    ? NATIONAL_PREFERENCE_SATISFACTION_WEIGHTS
    : SATISFACTION_WEIGHTS[focus];
  const previousRaceIds = new Set(
    previousObjectives.flatMap((objective) =>
      objective.kind === "race_result" ? [objective.raceId] : [],
    ),
  );
  const portfolio = selectSponsorObjectivePortfolio({
    sponsorCountryCode: normalizedCountryCode,
    sponsorContinentCode,
    sportingPhilosophy,
    ambitionLevel,
    sponsorPrestige,
    targetSeasonGameYear,
    teamReputationPoints,
    raceCandidates,
    previousRaceIds,
    random,
  });
  const previousRaceRanks = previousObjectives.flatMap((objective) =>
    objective.kind === "race_result" && objective.targetRank !== null
      ? [objective.targetRank]
      : [],
  );
  const firstTopRank = getTopRankForAmbition(
    ambitionLevel,
    random,
    previousRaceRanks,
  );
  const secondTopRank = getTopRankForAmbition(
    ambitionLevel,
    random,
    [...previousRaceRanks, firstTopRank],
  );
  const previousNationalityPercentages = previousObjectives.flatMap(
    (objective) =>
      objective.kind === "nationality_quota"
        ? [objective.minimumPercentage]
        : [],
  );
  const nationalityPercentage = sportingPhilosophy === "national_preference"
    ? getNationalPreferencePercentageForAmbition(
        ambitionLevel,
        random,
        previousNationalityPercentages,
      )
    : getNationalityPercentageForAmbition(
        ambitionLevel,
        random,
        previousNationalityPercentages,
      );
  const seasonWinScope = selectVariedValue(
    getSeasonWinScopesForPhilosophy(sportingPhilosophy),
    previousObjectives.flatMap((objective) =>
      objective.kind === "season_wins" ? [objective.winScope] : [],
    ),
    random,
  );
  const minimumSeasonWinCount = getSeasonWinCountForAmbition(
    ambitionLevel,
    random,
    previousObjectives.flatMap((objective) =>
      objective.kind === "season_wins" && objective.winScope === seasonWinScope
        ? [objective.minimumWinCount]
        : [],
    ),
  );
  const targetUciRank = getUciRankForAmbition(
    ambitionLevel,
    random,
    previousObjectives.flatMap((objective) =>
      objective.kind === "uci_ranking" ? [objective.targetRank] : [],
    ),
  );
  const targetNationUciRank = getNationUciRankForAmbition(
    ambitionLevel,
    random,
    previousObjectives.flatMap((objective) =>
      objective.kind === "nation_uci_ranking"
        ? [objective.targetRank]
        : [],
    ),
  );
  const championshipType = selectNationalChampionshipType({
    sportingPhilosophy,
    previousObjectives,
    random,
  });
  const normalizedRelationshipYear = Math.max(1, Math.floor(relationshipYear));
  const includeFormation = normalizedRelationshipYear >= 2;
  const includeInfrastructure =
    sponsorPrestige < 4 &&
    !includeFormation &&
    stableSponsorBucket(sponsorCatalogKey || normalizedCountryCode, 6) === 0;
  const recruitmentCandidate =
    includeRiderRecruitmentObjective &&
    shouldSponsorRequestRiderRecruitment({
      sponsorCatalogKey: sponsorCatalogKey || normalizedCountryCode,
      sportingPhilosophy,
    })
      ? selectSponsorRecruitmentRider({
          sponsorCountryCode: normalizedCountryCode,
          sportingPhilosophy,
          teamReputationPoints,
          riderCandidates,
          random,
        })
      : null;

  const domesticRaceObjective =
    ambitionLevel >= 4
      ? createRaceWinObjective(
          portfolio.domestic,
          getPriorityForRaceWin(ambitionLevel)
        )
      : createRaceTopObjective(
          portfolio.domestic,
          firstTopRank,
          getPriorityForTopRank(firstTopRank)
        );

  const regionalRaceObjective = createRaceTopObjective(
    portfolio.regional,
    secondTopRank,
    getPriorityForTopRank(secondTopRank)
  );

  const philosophyRaceObjective = createPhilosophyRaceObjective({
    race: portfolio.philosophyPrimary,
    ambitionLevel,
    random,
  });

  const leaderObjective = createNewLeaderOpportunityObjective({
    sponsorCountryCode: normalizedCountryCode,
    sponsorContinentCode,
    sportingPhilosophy,
    ambitionLevel,
    sponsorPrestige,
    targetSeasonGameYear,
    teamReputationPoints,
    teamRiderCandidates,
    raceCandidates,
    excludedRaceIds: new Set([
      portfolio.domestic.raceId,
      portfolio.regional.raceId,
      portfolio.philosophyPrimary.raceId,
    ]),
    previousRaceIds,
    random,
  });

  const ambitionObjective = selectFlexibleObjective({
    candidates: [
      recruitmentCandidate
        ? createRiderRecruitmentObjective(
            recruitmentCandidate,
            resolveSponsorRecruitmentOverallRange(teamReputationPoints).maximum,
          )
        : null,
      leaderObjective,
      includeFormation
        ? createHomegrownRosterObjective(Math.min(30, ambitionLevel * 5))
        : null,
      portfolio.philosophySecondary
        ? createPhilosophyRaceObjective({
            race: portfolio.philosophySecondary,
            ambitionLevel,
            random,
          })
        : null,
      createSeasonWinsObjective(
        Math.max(1, ambitionLevel),
        "stages",
        "Victoires d’étape",
      ),
    ],
    previousObjectives,
  });

  const legacyObjective = selectFlexibleObjective({
    candidates: [
      includeInfrastructure ? createInfrastructureObjective(1) : null,
      ...getLegacyWinScopesForPhilosophy(sportingPhilosophy).map((scope) =>
        createSeasonWinsObjective(
          Math.max(1, Math.ceil(ambitionLevel / 2)),
          scope,
          getSeasonWinLabel(scope),
        ),
      ),
    ],
    previousObjectives,
  });

  const objectives = sportingPhilosophy === "youth_development"
    ? createYouthDevelopmentPortfolio({
        domesticRaceObjective,
        regionalRaceObjective,
        philosophyRaceObjective,
        normalizedCountryCode,
        nationalityPercentage,
        minimumSeasonWinCount,
        targetUciRank,
        ambitionLevel,
      })
    : [
        withSatisfactionPoints(domesticRaceObjective, weights.domesticRace),
        withSatisfactionPoints(regionalRaceObjective, weights.regionalRace),
        withSatisfactionPoints(
          createNationalityObjective(normalizedCountryCode, nationalityPercentage),
          weights.nationality
        ),
        withSatisfactionPoints(
          createSeasonWinsObjective(
            minimumSeasonWinCount,
            seasonWinScope,
            getSeasonWinLabel(seasonWinScope),
          ),
          weights.seasonWins
        ),
        withSatisfactionPoints(
          philosophyRaceObjective,
          weights.specialtyWins
        ),
        withSatisfactionPoints(
          createUciRankingObjective(targetUciRank),
          weights.teamRanking
        ),
        withSatisfactionPoints(
          createNationUciRankingObjective(
            normalizedCountryCode,
            targetNationUciRank,
          ),
          weights.nationRanking
        ),
        withSatisfactionPoints(
          createNationalChampionshipObjective(
            normalizedCountryCode,
            championshipType,
          ),
          weights.nationalChampionship
        ),
        withSatisfactionPoints(ambitionObjective, weights.ambition),
        withSatisfactionPoints(legacyObjective, weights.legacy),
      ];

  const shuffledObjectives = shuffleValues(objectives, random);
  const satisfactionTotal = shuffledObjectives.reduce(
    (total, objective) => total + objective.satisfactionPoints,
    0
  );

  if (
    shuffledObjectives.length !== OBJECTIVE_COUNT ||
    satisfactionTotal !== 100
  ) {
    throw new Error(
      "Le générateur doit produire exactement dix objectifs totalisant 100 points de satisfaction."
    );
  }

  return shuffledObjectives.map((objective, index) => ({
    ...objective,
    displayOrder: index + 1,
    targetDetails: {
      ...objective.targetDetails,
      generationVersion: SPONSOR_OBJECTIVE_GENERATION_VERSION,
      sportingPhilosophy,
      ambitionLevel,
      objectiveDifficulty,
    },
  }));
}

export function resolveSponsorObjectiveAmbitionLevel({
  sponsorPrestige,
  proposedBudget,
}: {
  sponsorPrestige: SponsorPrestige;
  proposedBudget: number;
}): SponsorObjectiveAmbitionLevel {
  if (!Number.isFinite(proposedBudget) || proposedBudget <= 0) {
    throw new Error(
      "Le budget proposé doit être un montant positif pour fixer les objectifs sponsor.",
    );
  }

  // Le prestige fixe le socle d’exigence de la marque ; le montant de l’offre
  // peut l’élever, avec un niveau premium propre aux offres d’au moins 2 M€.
  const budgetLevel: SponsorObjectiveAmbitionLevel =
    proposedBudget >= 2_000_000
      ? 6
      : proposedBudget >= 1_500_000
        ? 5
        : proposedBudget >= 1_000_000
          ? 4
          : proposedBudget >= 650_000
            ? 3
            : proposedBudget >= 350_000
              ? 2
              : 1;

  return Math.max(
    sponsorPrestige,
    budgetLevel,
  ) as SponsorObjectiveAmbitionLevel;
}

const RECRUITMENT_PROFILE_BY_PHILOSOPHY: Partial<Record<
  SponsorSportingPhilosophy,
  RiderSpecialtyProfile
>> = {
  cobbled_classics: "Coureur de pavés",
  ardennes_classics: "Puncheur",
  medium_stage_races: "Coureur de tour",
  time_trials: "Rouleur",
  sprints: "Sprinteur",
  grand_tour_general: "Coureur de tour",
};

export function shouldSponsorRequestRiderRecruitment({
  sponsorCatalogKey,
  sportingPhilosophy,
}: {
  sponsorCatalogKey: string;
  sportingPhilosophy: SponsorSportingPhilosophy;
}): boolean {
  return Boolean(RECRUITMENT_PROFILE_BY_PHILOSOPHY[sportingPhilosophy]) &&
    stableSponsorBucket(`${sponsorCatalogKey}:rider-recruitment`, 3) === 0;
}

export function resolveSponsorRecruitmentOverallRange(
  teamReputationPoints: number,
): { minimum: number; maximum: number } {
  const reputation = Math.max(0, Math.floor(teamReputationPoints));
  const maximum = reputation < 75
    ? 66
    : reputation < 150
      ? 69
      : reputation < 300
        ? 72
        : reputation < 500
          ? 75
          : reputation < 750
            ? 79
            : 84;

  return { minimum: maximum - 10, maximum };
}

export function selectSponsorRecruitmentRider({
  sponsorCountryCode,
  sportingPhilosophy,
  teamReputationPoints,
  riderCandidates,
  random = Math.random,
}: {
  sponsorCountryCode: string;
  sportingPhilosophy: SponsorSportingPhilosophy;
  teamReputationPoints: number;
  riderCandidates: readonly SponsorObjectiveRiderCandidate[];
  random?: () => number;
}): SponsorObjectiveRiderCandidate | null {
  const expectedProfile =
    RECRUITMENT_PROFILE_BY_PHILOSOPHY[sportingPhilosophy];

  if (!expectedProfile) return null;

  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();
  const range = resolveSponsorRecruitmentOverallRange(teamReputationPoints);
  const eligibleCandidates = riderCandidates.filter(
    (candidate) =>
      candidate.countryCode.trim().toUpperCase() === normalizedCountryCode &&
      candidate.overallRating <= range.maximum &&
      candidate.sportingProfile.includes(expectedProfile),
  );
  const preferredCandidates = eligibleCandidates.filter(
    (candidate) => candidate.overallRating >= range.minimum,
  );
  const rankedCandidates = [
    ...(preferredCandidates.length > 0
      ? preferredCandidates
      : eligibleCandidates),
  ].sort(
    (left, right) =>
      getRecruitmentPhilosophyScore(right.ratings, sportingPhilosophy) -
        getRecruitmentPhilosophyScore(left.ratings, sportingPhilosophy) ||
      right.overallRating - left.overallRating ||
      left.riderName.localeCompare(right.riderName, "fr"),
  );
  const shortlist = rankedCandidates.slice(0, 3);

  if (shortlist.length === 0) return null;

  return shortlist[
    Math.min(shortlist.length - 1, Math.floor(random() * shortlist.length))
  ];
}

function getRecruitmentPhilosophyScore(
  ratings: RiderRatings,
  sportingPhilosophy: SponsorSportingPhilosophy,
): number {
  switch (sportingPhilosophy) {
    case "cobbled_classics":
      return ratings.cobbles * 0.65 + ratings.endurance * 0.2 +
        ratings.resistance * 0.15;
    case "ardennes_classics":
      return ratings.hills * 0.6 + ratings.acceleration * 0.25 +
        ratings.resistance * 0.15;
    case "medium_stage_races":
    case "grand_tour_general":
      return ratings.mountain * 0.35 + ratings.timeTrial * 0.25 +
        ratings.recovery * 0.2 + ratings.endurance * 0.2;
    case "time_trials":
      return ratings.timeTrial * 0.7 + ratings.prologue * 0.2 +
        ratings.flat * 0.1;
    case "sprints":
      return ratings.sprint * 0.55 + ratings.acceleration * 0.3 +
        ratings.flat * 0.15;
    case "national_preference":
    case "youth_development":
      return 0;
  }
}

function createNewLeaderOpportunityObjective({
  sponsorCountryCode,
  sponsorContinentCode,
  sportingPhilosophy,
  ambitionLevel,
  sponsorPrestige,
  targetSeasonGameYear,
  teamReputationPoints,
  teamRiderCandidates,
  raceCandidates,
  excludedRaceIds,
  previousRaceIds,
  random,
}: {
  sponsorCountryCode: string;
  sponsorContinentCode: string | null;
  sportingPhilosophy: SponsorSportingPhilosophy;
  ambitionLevel: SponsorObjectiveAmbitionLevel;
  sponsorPrestige: SponsorPrestige;
  targetSeasonGameYear: number;
  teamReputationPoints: number;
  teamRiderCandidates: readonly SponsorObjectiveTeamRiderCandidate[];
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  excludedRaceIds: ReadonlySet<string>;
  previousRaceIds: ReadonlySet<string>;
  random: () => number;
}): ObjectiveWithoutDisplayOrder | null {
  if (sportingPhilosophy === "youth_development") return null;

  const opportunity = selectNewLeaderOpportunity(
    teamRiderCandidates,
    sportingPhilosophy === "national_preference"
      ? { riderCountryCode: sponsorCountryCode }
      : undefined,
  );

  if (!opportunity) return null;

  const eligibleRaces = selectPrestigeAlignedSponsorObjectiveRaceCandidates({
    candidates: getEligibleSponsorObjectiveRaces({
      teamReputationPoints,
      raceCandidates,
    }),
    sponsorPrestige,
    targetSeasonGameYear,
    minimumCount: 1,
  }).filter(
    (race) =>
      !excludedRaceIds.has(race.raceId) &&
      matchesLeaderDomain(race, opportunity.domain),
  );
  const race = selectRaceBySponsorGeography({
    candidates: eligibleRaces,
    sponsorCountryCode,
    sponsorContinentCode,
    previousRaceIds,
    random,
  });

  if (!race) return null;

  const targetRank = getTopRankForAmbition(ambitionLevel, random);
  const objective = createRaceTopObjective(
    race,
    targetRank,
    getPriorityForTopRank(targetRank),
  );

  return {
    ...objective,
    name: `Capitaliser sur l’arrivée de ${opportunity.rider.riderName}`,
    description:
      `Le sponsor voit en ${opportunity.rider.riderName} un nouveau leader ${getLeaderDomainLabel(opportunity.domain)} : obtenir un top ${targetRank} sur ${race.raceLabel}.`,
    targetDetails: {
      ...objective.targetDetails,
      variationReason: "new_leader_opportunity",
      leaderRiderId: opportunity.rider.riderId,
      leaderRiderName: opportunity.rider.riderName,
      leaderDomain: opportunity.domain,
    },
  };
}

export function selectNewLeaderOpportunity(
  teamRiderCandidates: readonly SponsorObjectiveTeamRiderCandidate[],
  options?: { riderCountryCode?: string },
): {
  rider: SponsorObjectiveTeamRiderCandidate;
  domain: SponsorLeaderDomain;
  score: number;
} | null {
  const establishedRiders = teamRiderCandidates.filter(
    (rider) => !rider.joinedForTargetSeason,
  );
  if (establishedRiders.length === 0) return null;
  const normalizedRiderCountryCode = options?.riderCountryCode
    ?.trim()
    .toUpperCase();

  const opportunities = teamRiderCandidates
    .filter(
      (rider) =>
        rider.joinedForTargetSeason &&
        (!normalizedRiderCountryCode ||
          rider.countryCode.trim().toUpperCase() ===
            normalizedRiderCountryCode),
    )
    .flatMap((rider) =>
      LEADER_DOMAINS.flatMap((domain) => {
        const score = getLeaderDomainScore(rider.ratings, domain);
        const establishedBest = establishedRiders.reduce(
          (best, establishedRider) =>
            Math.max(
              best,
              getLeaderDomainScore(establishedRider.ratings, domain),
            ),
          Number.NEGATIVE_INFINITY,
        );

        if (
          score < 58 ||
          rider.overallRating < 58 ||
          (Number.isFinite(establishedBest) && score < establishedBest + 2.5)
        ) {
          return [];
        }

        return [{
          rider,
          domain,
          score,
          gap: Number.isFinite(establishedBest)
            ? score - establishedBest
            : score,
        }];
      }),
    )
    .sort(
      (left, right) =>
        right.gap - left.gap ||
        right.score - left.score ||
        right.rider.overallRating - left.rider.overallRating ||
        left.rider.riderName.localeCompare(right.rider.riderName, "fr"),
    );

  const selected = opportunities[0];
  return selected
    ? { rider: selected.rider, domain: selected.domain, score: selected.score }
    : null;
}

const LEADER_DOMAINS: readonly SponsorLeaderDomain[] = [
  "cobbles",
  "hills",
  "sprints",
  "time_trials",
  "stage_races",
  "mountain",
];

function getLeaderDomainScore(
  ratings: RiderRatings,
  domain: SponsorLeaderDomain,
): number {
  switch (domain) {
    case "cobbles":
      return ratings.cobbles * 0.65 + ratings.endurance * 0.2 +
        ratings.resistance * 0.15;
    case "hills":
      return ratings.hills * 0.6 + ratings.acceleration * 0.25 +
        ratings.resistance * 0.15;
    case "sprints":
      return ratings.sprint * 0.55 + ratings.acceleration * 0.3 +
        ratings.flat * 0.15;
    case "time_trials":
      return ratings.timeTrial * 0.7 + ratings.prologue * 0.2 +
        ratings.flat * 0.1;
    case "stage_races":
      return ratings.mountain * 0.35 + ratings.timeTrial * 0.25 +
        ratings.recovery * 0.2 + ratings.endurance * 0.2;
    case "mountain":
      return ratings.mountain * 0.65 + ratings.endurance * 0.2 +
        ratings.recovery * 0.15;
  }
}

function matchesLeaderDomain(
  race: SponsorObjectiveRaceCandidate,
  domain: SponsorLeaderDomain,
): boolean {
  const profiles = new Set(race.profileTypes ?? []);

  switch (domain) {
    case "cobbles":
      return profiles.has("cobbles");
    case "hills":
      return profiles.has("hilly");
    case "sprints":
      return profiles.has("sprint") || profiles.has("flat");
    case "time_trials":
      return profiles.has("time_trial") ||
        race.competitionType === "national_time_trial";
    case "stage_races":
      return race.raceFormat === "stage_race";
    case "mountain":
      return profiles.has("mountain");
  }
}

function selectRaceBySponsorGeography({
  candidates,
  sponsorCountryCode,
  sponsorContinentCode,
  previousRaceIds,
  random,
}: {
  candidates: readonly SponsorObjectiveRaceCandidate[];
  sponsorCountryCode: string;
  sponsorContinentCode: string | null;
  previousRaceIds: ReadonlySet<string>;
  random: () => number;
}): SponsorObjectiveRaceCandidate | null {
  const continentCode = sponsorContinentCode?.trim().toLowerCase() ?? "";
  const groups = [
    candidates.filter(
      (race) => race.countryCode.trim().toUpperCase() === sponsorCountryCode,
    ),
    candidates.filter((race) =>
      areSponsorCountriesNeighbors(sponsorCountryCode, race.countryCode),
    ),
    candidates.filter(
      (race) =>
        continentCode !== "" &&
        race.continentCode?.trim().toLowerCase() === continentCode,
    ),
    [...candidates],
  ];

  for (const group of groups) {
    if (group.length === 0) continue;
    const unseen = group.filter((race) => !previousRaceIds.has(race.raceId));
    return shuffleValues(unseen.length > 0 ? unseen : group, random)[0] ?? null;
  }

  return null;
}

function getLeaderDomainLabel(domain: SponsorLeaderDomain): string {
  const labels: Record<SponsorLeaderDomain, string> = {
    cobbles: "sur les pavés",
    hills: "sur les parcours vallonnés",
    sprints: "dans les sprints",
    time_trials: "contre la montre",
    stage_races: "sur les courses par étapes",
    mountain: "en montagne",
  };

  return labels[domain];
}

function selectFlexibleObjective({
  candidates,
  previousObjectives,
}: {
  candidates: readonly (ObjectiveWithoutDisplayOrder | null)[];
  previousObjectives: readonly SponsorObjectiveTargetDetails[];
}): ObjectiveWithoutDisplayOrder {
  const available = candidates.filter(
    (candidate): candidate is ObjectiveWithoutDisplayOrder => candidate !== null,
  );

  if (available.length === 0) {
    throw new Error("Aucun objectif sponsor flexible n’est disponible.");
  }

  const previousSignatures = new Set(
    previousObjectives.map(getObjectiveHistorySignature),
  );
  return available.find(
    (objective) =>
      !previousSignatures.has(getObjectiveHistorySignature(objective.targetDetails)),
  ) ?? available[0];
}

function getObjectiveHistorySignature(
  details: SponsorObjectiveTargetDetails,
): string {
  switch (details.kind) {
    case "race_result":
      return `race:${details.raceId}`;
    case "nationality_quota":
      return `nationality:${details.minimumPercentage}`;
    case "season_wins":
      return `wins:${details.winScope}:${details.minimumWinCount}`;
    case "uci_ranking":
      return `team-rank:${details.targetRank}`;
    case "nation_uci_ranking":
      return `nation-rank:${details.targetRank}`;
    case "national_championship":
      return `national-title:${details.championshipType}`;
    case "homegrown_roster":
      return `homegrown:${details.minimumPercentage}`;
    case "youth_development":
      return `youth:${details.metric}:${details.minimumCount}`;
    case "rider_recruitment":
      return `recruitment:${details.riderId}`;
    case "infrastructure":
      return `infrastructure:${details.minimumCompletedCount}`;
  }
}

function withSatisfactionPoints(
  objective: ObjectiveWithoutDisplayOrder,
  satisfactionPoints: number
): ObjectiveWithoutDisplayOrder {
  return {
    ...objective,
    satisfactionPoints,
    priority: getPriorityForSatisfactionPoints(satisfactionPoints),
    renewalBonusPercent: 0,
  };
}

function createYouthDevelopmentPortfolio({
  domesticRaceObjective,
  regionalRaceObjective,
  philosophyRaceObjective,
  normalizedCountryCode,
  nationalityPercentage,
  minimumSeasonWinCount,
  targetUciRank,
  ambitionLevel,
}: {
  domesticRaceObjective: ObjectiveWithoutDisplayOrder;
  regionalRaceObjective: ObjectiveWithoutDisplayOrder;
  philosophyRaceObjective: ObjectiveWithoutDisplayOrder;
  normalizedCountryCode: string;
  nationalityPercentage: number;
  minimumSeasonWinCount: number;
  targetUciRank: number;
  ambitionLevel: SponsorObjectiveAmbitionLevel;
}): ObjectiveWithoutDisplayOrder[] {
  const promotionsByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
  };
  const developmentRosterByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 6,
    2: 7,
    3: 8,
    4: 9,
    5: 10,
    6: 12,
  };
  const juniorWinsByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
  };
  const homegrownSalesByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 1,
    2: 1,
    3: 1,
    4: 2,
    5: 2,
    6: 3,
  };

  return [
    withSatisfactionPoints(domesticRaceObjective, 8),
    withSatisfactionPoints(regionalRaceObjective, 5),
    withSatisfactionPoints(
      createNationalityObjective(normalizedCountryCode, nationalityPercentage),
      4,
    ),
    withSatisfactionPoints(
      createSeasonWinsObjective(
        minimumSeasonWinCount,
        "all",
        "Victoires sur la saison",
      ),
      6,
    ),
    withSatisfactionPoints(philosophyRaceObjective, 5),
    withSatisfactionPoints(createUciRankingObjective(targetUciRank), 6),
    withSatisfactionPoints(
      createYouthDevelopmentObjective(
        "promotions",
        promotionsByAmbition[ambitionLevel],
      ),
      18,
    ),
    withSatisfactionPoints(
      createYouthDevelopmentObjective(
        "development_roster",
        developmentRosterByAmbition[ambitionLevel],
      ),
      15,
    ),
    withSatisfactionPoints(
      createYouthDevelopmentObjective(
        "junior_race_wins",
        juniorWinsByAmbition[ambitionLevel],
      ),
      18,
    ),
    withSatisfactionPoints(
      createYouthDevelopmentObjective(
        "homegrown_sales",
        homegrownSalesByAmbition[ambitionLevel],
      ),
      15,
    ),
  ];
}

function createYouthDevelopmentObjective(
  metric:
    | "promotions"
    | "development_roster"
    | "junior_race_wins"
    | "homegrown_sales",
  minimumCount: number,
): ObjectiveWithoutDisplayOrder {
  const copy = {
    promotions: {
      name: `Former et promouvoir ${minimumCount} jeune(s)`,
      description:
        `Faire signer professionnel ${minimumCount} coureur(s) issu(s) de votre Centre de formation pendant la saison.`,
    },
    development_roster: {
      name: `Développer une Dev Team de ${minimumCount} juniors`,
      description:
        `Constituer pendant la saison une Development Team comptant au moins ${minimumCount} junior(s).`,
    },
    junior_race_wins: {
      name: `Remporter ${minimumCount} course(s) juniors`,
      description:
        `Gagner au moins ${minimumCount} classement(s) général(aux) avec votre Development Team pendant la saison.`,
    },
    homegrown_sales: {
      name: `Valoriser et vendre ${minimumCount} coureur(s) formé(s) au club`,
      description:
        `Céder sur le marché des transferts ${minimumCount} coureur(s) professionnel(s) précédemment formé(s) par votre Centre de formation.`,
    },
  } as const;

  return {
    ...copy[metric],
    objectiveType: "youth_development",
    priority: "important",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "youth_development",
      metric,
      minimumCount,
    },
  };
}

function getPriorityForSatisfactionPoints(
  satisfactionPoints: number
): SponsorObjectivePriority {
  if (satisfactionPoints >= 17) return "mandatory";
  if (satisfactionPoints >= 11) return "important";
  if (satisfactionPoints >= 6) return "standard";
  return "optional";
}

export function resolveSponsorObjectiveFocus({
  sponsorCatalogKey,
  sponsorSector,
  sponsorPrestige,
}: {
  sponsorCatalogKey: string;
  sponsorSector: string;
  sponsorPrestige: SponsorPrestige;
}): SponsorObjectiveFocus {
  if (sponsorPrestige >= 4) {
    return "prestige";
  }

  const normalizedSector = sponsorSector
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    /(cycliste.*developpement|developpement.*cycliste|laboratoire.*cycliste|cycliste.*haute performance|essais cycliste|equipe-test cycliste)/.test(
      normalizedSector
    )
  ) {
    return "talent_development";
  }

  if (
    /(technolog|ingenier|automobile|mobilite|energie|infrastructure|cybersecurite)/.test(
      normalizedSector
    )
  ) {
    return "sporting_performance";
  }

  if (
    /(agro|aliment|tourisme|confiserie|brasserie|cafe|agriculture|postal|courrier|mode|luxe|spiritueux|arak|baijiu|brandy|cachaca|gin|pisco|rhum|tequila|vodka|whisky|restauration|patisserie|pizzeria|sushi|tacos|wok)/.test(
      normalizedSector
    )
  ) {
    return stableSponsorBucket(sponsorCatalogKey || normalizedSector, 2) === 0
      ? "national_identity"
      : "territorial_races";
  }

  const fallbackFocuses: readonly SponsorObjectiveFocus[] = [
    "national_identity",
    "territorial_races",
    "sporting_performance",
    "talent_development",
  ];

  return fallbackFocuses[
    stableSponsorBucket(sponsorCatalogKey || normalizedSector, fallbackFocuses.length)
  ];
}

export function areSponsorCountriesNeighbors(
  firstCountryCode: string,
  secondCountryCode: string
): boolean {
  const normalizedFirst = firstCountryCode.trim().toUpperCase();
  const normalizedSecond = secondCountryCode.trim().toUpperCase();

  return (
    SPONSOR_COUNTRY_NEIGHBORS[normalizedFirst]?.includes(normalizedSecond) ??
    false
  );
}
function stableSponsorBucket(value: string, bucketCount: number): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) % bucketCount;
}

function selectSponsorObjectivePortfolio({
  sponsorCountryCode,
  sponsorContinentCode,
  sportingPhilosophy,
  ambitionLevel,
  sponsorPrestige,
  targetSeasonGameYear,
  teamReputationPoints,
  raceCandidates,
  previousRaceIds,
  random,
}: {
  sponsorCountryCode: string;
  sponsorContinentCode: string | null;
  sportingPhilosophy: SponsorSportingPhilosophy;
  ambitionLevel: SponsorObjectiveAmbitionLevel;
  sponsorPrestige: SponsorPrestige;
  targetSeasonGameYear: number;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  previousRaceIds: ReadonlySet<string>;
  random: () => number;
}): {
  domestic: SponsorObjectiveRaceCandidate;
  regional: SponsorObjectiveRaceCandidate;
  philosophyPrimary: SponsorObjectiveRaceCandidate;
  philosophySecondary: SponsorObjectiveRaceCandidate | null;
} {
  const eligible = getEligibleSponsorObjectiveRaces({
    teamReputationPoints,
    raceCandidates,
  });
  const categoryPolicyEnabled = isSponsorObjectivePrestigeCategoryPolicyEnabled(
    targetSeasonGameYear,
  );
  const topPrestigeRaceIds = new Set(
    selectPrestigeAlignedSponsorObjectiveRaceCandidates({
      candidates: eligible,
      sponsorPrestige,
      targetSeasonGameYear,
      minimumCount: 1,
    }).map((candidate) => candidate.raceId),
  );
  const usedRaceIds = new Set<string>();
  const takeFromCandidates = (
    candidates: readonly SponsorObjectiveRaceCandidate[],
  ): SponsorObjectiveRaceCandidate | null => {
    const unseenCandidates = candidates.filter(
      (candidate) => !previousRaceIds.has(candidate.raceId),
    );
    const candidate = shuffleValues(
      unseenCandidates.length > 0 ? unseenCandidates : candidates,
      random,
    )[0];

    if (candidate) usedRaceIds.add(candidate.raceId);
    return candidate ?? null;
  };
  const take = (
    predicate: (candidate: SponsorObjectiveRaceCandidate) => boolean
  ): SponsorObjectiveRaceCandidate | null => {
    const candidates = eligible.filter(
      (entry) => !usedRaceIds.has(entry.raceId) && predicate(entry),
    );
    const prestigeAlignedCandidates =
      selectPrestigeAlignedSponsorObjectiveRaceCandidates({
        candidates,
        sponsorPrestige,
        targetSeasonGameYear,
        minimumCount: 1,
      });

    return takeFromCandidates(prestigeAlignedCandidates);
  };
  const takeAny = () => take(() => true);
  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();
  const normalizedContinentCode = (
    sponsorContinentCode ??
    eligible.find(
      (candidate) =>
        candidate.countryCode.toUpperCase() === normalizedCountryCode,
    )?.continentCode ??
    ""
  )
    .trim()
    .toLowerCase();
  const takeByGeography = (
    predicate: (candidate: SponsorObjectiveRaceCandidate) => boolean,
  ): SponsorObjectiveRaceCandidate | null => {
    if (!categoryPolicyEnabled) {
      return take(
        (candidate) =>
          candidate.countryCode.toUpperCase() === normalizedCountryCode &&
          predicate(candidate),
      ) ??
        take(
          (candidate) =>
            areSponsorCountriesNeighbors(
              normalizedCountryCode,
              candidate.countryCode,
            ) && predicate(candidate),
        ) ??
        take(
          (candidate) =>
            normalizedContinentCode !== "" &&
            candidate.continentCode?.toLowerCase() === normalizedContinentCode &&
            predicate(candidate),
        ) ??
        take(predicate);
    }

    const availableCandidates = eligible.filter(
      (candidate) => !usedRaceIds.has(candidate.raceId) && predicate(candidate),
    );
    const prestigeAlignedCandidates =
      selectPrestigeAlignedSponsorObjectiveRaceCandidates({
        candidates: availableCandidates,
        sponsorPrestige,
        targetSeasonGameYear,
        minimumCount: 1,
      });
    const takeGeographicCandidates = (
      geographyPredicate: (candidate: SponsorObjectiveRaceCandidate) => boolean,
    ) => takeFromCandidates(
      prestigeAlignedCandidates.filter(geographyPredicate),
    );

    return takeGeographicCandidates(
      (candidate) =>
        candidate.countryCode.toUpperCase() === normalizedCountryCode,
    ) ??
      takeGeographicCandidates((candidate) =>
        areSponsorCountriesNeighbors(
          normalizedCountryCode,
          candidate.countryCode,
        )
      ) ??
      takeGeographicCandidates(
        (candidate) =>
          normalizedContinentCode !== "" &&
          candidate.continentCode?.toLowerCase() === normalizedContinentCode,
      ) ??
      takeFromCandidates(prestigeAlignedCandidates);
  };

  const philosophyPredicate = (
    candidate: SponsorObjectiveRaceCandidate,
  ) => matchesSponsorSportingPhilosophy(candidate, sportingPhilosophy);
  const flagshipPhilosophyPredicate = (
    candidate: SponsorObjectiveRaceCandidate,
  ) => {
    if (!philosophyPredicate(candidate)) return false;

    if (sportingPhilosophy === "grand_tour_general") {
      return candidate.isGrandTour === true;
    }

    if (
      sportingPhilosophy === "cobbled_classics" ||
      sportingPhilosophy === "ardennes_classics"
    ) {
      return candidate.isMonument === true;
    }

    return (
      candidate.categoryCode === "world" ||
      candidate.isMonument === true ||
      candidate.isGrandTour === true
    );
  };
  const philosophyPrimary =
    (categoryPolicyEnabled && ambitionLevel >= 6
      ? take(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            flagshipPhilosophyPredicate(candidate),
        )
      : null) ??
    (categoryPolicyEnabled
      ? takeByGeography(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            philosophyPredicate(candidate),
        )
      : null) ??
    (categoryPolicyEnabled
      ? takeByGeography((candidate) => topPrestigeRaceIds.has(candidate.raceId))
      : null) ??
    (ambitionLevel >= 6 ? take(flagshipPhilosophyPredicate) : null) ??
    takeByGeography(philosophyPredicate) ??
    (sportingPhilosophy === "grand_tour_general"
      ? takeByGeography(
          (candidate) =>
            candidate.raceFormat === "stage_race" &&
            candidate.isGrandTour !== true,
        )
      : null) ??
    takeByGeography(() => true);

  const domestic =
    (categoryPolicyEnabled
      ? take(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            candidate.countryCode.toUpperCase() === normalizedCountryCode &&
            candidate.raceFormat === "stage_race",
        ) ??
        take(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            candidate.countryCode.toUpperCase() === normalizedCountryCode,
        ) ??
        takeByGeography((candidate) => topPrestigeRaceIds.has(candidate.raceId))
      : null) ??
    take(
      (candidate) =>
        candidate.countryCode.toUpperCase() === normalizedCountryCode &&
        candidate.raceFormat === "stage_race"
    ) ??
    take(
      (candidate) =>
        candidate.countryCode.toUpperCase() === normalizedCountryCode
    ) ??
    takeByGeography(() => true);

  const regional =
    (categoryPolicyEnabled
      ? take(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            areSponsorCountriesNeighbors(
              normalizedCountryCode,
              candidate.countryCode,
            ),
        ) ??
        take(
          (candidate) =>
            topPrestigeRaceIds.has(candidate.raceId) &&
            normalizedContinentCode !== "" &&
            candidate.continentCode?.toLowerCase() === normalizedContinentCode &&
            candidate.countryCode.toUpperCase() !== normalizedCountryCode,
        ) ??
        takeAny()
      : null) ??
    take((candidate) =>
      areSponsorCountriesNeighbors(
        normalizedCountryCode,
        candidate.countryCode
      )
    ) ??
    take(
      (candidate) =>
        normalizedContinentCode !== "" &&
        candidate.continentCode?.toLowerCase() === normalizedContinentCode &&
        candidate.countryCode.toUpperCase() !== normalizedCountryCode,
    ) ??
    takeAny();

  const philosophySecondary = categoryPolicyEnabled
    ? takeByGeography(
        (candidate) =>
          topPrestigeRaceIds.has(candidate.raceId) &&
          philosophyPredicate(candidate),
      )
    : takeByGeography(philosophyPredicate);

  if (!domestic || !regional || !philosophyPrimary) {
    throw new Error(
      "Au moins trois courses accessibles sont nécessaires pour les objectifs sponsor.",
    );
  }

  return {
    domestic,
    regional,
    philosophyPrimary,
    philosophySecondary,
  };
}

export function matchesSponsorSportingPhilosophy(
  candidate: SponsorObjectiveRaceCandidate,
  sportingPhilosophy: SponsorSportingPhilosophy,
): boolean {
  const profileTypes = new Set(candidate.profileTypes ?? []);

  switch (sportingPhilosophy) {
    case "cobbled_classics":
      return candidate.raceFormat === "one_day" && profileTypes.has("cobbles");
    case "ardennes_classics":
      return candidate.raceFormat === "one_day" && profileTypes.has("hilly");
    case "medium_stage_races":
      return candidate.raceFormat === "stage_race" && candidate.isGrandTour !== true;
    case "time_trials":
      return (
        candidate.competitionType === "national_time_trial" ||
        profileTypes.has("time_trial")
      );
    case "sprints":
      return profileTypes.has("sprint") || profileTypes.has("flat");
    case "grand_tour_general":
      return candidate.isGrandTour === true;
    case "national_preference":
    case "youth_development":
      return false;
  }
}

function getEligibleSponsorObjectiveRaces({
  teamReputationPoints,
  raceCandidates,
}: {
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
}): SponsorObjectiveRaceCandidate[] {
  const normalizedReputation = Math.max(0, Math.floor(teamReputationPoints));
  const uniqueCandidates = new Map<string, SponsorObjectiveRaceCandidate>();

  for (const candidate of raceCandidates) {
    if (!isSponsorObjectiveRaceCandidateEligible(candidate, normalizedReputation)) {
      continue;
    }

    if (!uniqueCandidates.has(candidate.raceId)) {
      uniqueCandidates.set(candidate.raceId, candidate);
    }
  }

  return [...uniqueCandidates.values()];
}

function isSponsorObjectivePrestigeCategoryPolicyEnabled(
  targetSeasonGameYear: number,
): boolean {
  return Number.isFinite(targetSeasonGameYear) &&
    Math.floor(targetSeasonGameYear) >=
      SPONSOR_OBJECTIVE_PRESTIGE_CATEGORY_POLICY_START_GAME_YEAR;
}

function getSponsorObjectiveRaceCategoryTier(
  candidate: SponsorObjectiveRaceCandidate,
  sponsorPrestige: SponsorPrestige,
): number {
  const categoryBands =
    SPONSOR_OBJECTIVE_CATEGORY_PRIORITY_BY_PRESTIGE[sponsorPrestige];
  const categoryTier = categoryBands.findIndex((categoryCodes) =>
    candidate.categoryCode !== undefined &&
    categoryCodes.includes(candidate.categoryCode)
  );

  return categoryTier >= 0 ? categoryTier : categoryBands.length;
}

function selectPrestigeAlignedSponsorObjectiveRaceCandidates({
  candidates,
  sponsorPrestige,
  targetSeasonGameYear,
  minimumCount,
}: {
  candidates: readonly SponsorObjectiveRaceCandidate[];
  sponsorPrestige: SponsorPrestige;
  targetSeasonGameYear: number;
  minimumCount: number;
}): SponsorObjectiveRaceCandidate[] {
  if (
    !isSponsorObjectivePrestigeCategoryPolicyEnabled(targetSeasonGameYear) ||
    candidates.length === 0
  ) {
    return [...candidates];
  }

  const requiredCount = Math.min(
    candidates.length,
    Math.max(1, Math.floor(minimumCount)),
  );
  const selectedCandidates: SponsorObjectiveRaceCandidate[] = [];
  const maximumTier =
    SPONSOR_OBJECTIVE_CATEGORY_PRIORITY_BY_PRESTIGE[sponsorPrestige].length;

  for (let tier = 0; tier <= maximumTier; tier += 1) {
    selectedCandidates.push(
      ...candidates.filter(
        (candidate) =>
          getSponsorObjectiveRaceCategoryTier(candidate, sponsorPrestige) ===
          tier,
      ),
    );

    if (selectedCandidates.length >= requiredCount) {
      return selectedCandidates;
    }
  }

  return selectedCandidates;
}

export function isSponsorObjectiveRaceCandidateEligible(
  candidate: SponsorObjectiveRaceCandidate,
  teamReputationPoints: number,
): boolean {
  const normalizedReputation = Math.max(0, Math.floor(teamReputationPoints));

  return (
    candidate.categoryCode !== "regional" &&
    candidate.registrationPolicy === "open" &&
    candidate.minimumReputation !== null &&
    normalizedReputation >= candidate.minimumReputation &&
    isRaceCategoryUnlockedForSponsorObjectives(
      candidate.categoryCode,
      normalizedReputation,
    )
  );
}

export function isRaceCategoryUnlockedForSponsorObjectives(
  categoryCode: RaceCategoryCode | undefined,
  teamReputationPoints: number,
): boolean {
  if (!categoryCode) return true;

  const threshold = getRaceCategoryReputationThreshold(categoryCode);
  return threshold === null || teamReputationPoints >= threshold;
}

function createPhilosophyRaceObjective({
  race,
  ambitionLevel,
  random,
}: {
  race: SponsorObjectiveRaceCandidate;
  ambitionLevel: SponsorObjectiveAmbitionLevel;
  random: () => number;
}): ObjectiveWithoutDisplayOrder {
  if (ambitionLevel >= 5) {
    return createRaceWinObjective(race, "mandatory");
  }

  const targetRank =
    ambitionLevel === 4 ? 3 : getTopRankForAmbition(ambitionLevel, random);
  return createRaceTopObjective(
    race,
    targetRank,
    getPriorityForTopRank(targetRank),
  );
}
function createRaceWinObjective(
  race: SponsorObjectiveRaceCandidate,
  priority: SponsorObjectivePriority
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Remporter ${race.raceLabel}`,
    description:
      `Obtenir la victoire sur ${race.raceLabel} pendant la saison.`,
    objectiveType: "race_result",
    priority,
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "race_result",
      raceId: race.raceId,
      raceEditionId: race.raceEditionId,
      raceSlug: race.raceSlug,
      raceLabel: race.raceLabel,
      countryCode: race.countryCode,
      achievementType: "win",
      targetRank: null,
      requiredCount: 1,
    },
  };
}

function createRaceTopObjective(
  race: SponsorObjectiveRaceCandidate,
  targetRank: number,
  priority: SponsorObjectivePriority
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Top ${targetRank} sur ${race.raceLabel}`,
    description:
      `Placer au moins un coureur parmi les ${targetRank} premiers de ${race.raceLabel}.`,
    objectiveType: "race_result",
    priority,
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "race_result",
      raceId: race.raceId,
      raceEditionId: race.raceEditionId,
      raceSlug: race.raceSlug,
      raceLabel: race.raceLabel,
      countryCode: race.countryCode,
      achievementType: "top_n",
      targetRank,
      requiredCount: 1,
    },
  };
}

export function selectSponsorObjectiveRaces({
  sponsorCountryCode,
  sponsorContinentCode = null,
  sponsorPrestige,
  targetSeasonGameYear =
    SPONSOR_OBJECTIVE_PRESTIGE_CATEGORY_POLICY_START_GAME_YEAR - 1,
  teamReputationPoints,
  raceCandidates,
  count,
  random = Math.random,
}: {
  sponsorCountryCode: string;
  sponsorContinentCode?: string | null;
  sponsorPrestige?: SponsorPrestige;
  targetSeasonGameYear?: number;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  count: number;
  random?: () => number;
}): SponsorObjectiveRaceCandidate[] {
  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();
  const allEligibleCandidates = getEligibleSponsorObjectiveRaces({
    teamReputationPoints,
    raceCandidates,
  });
  const categoryPolicyEnabled = sponsorPrestige !== undefined &&
    isSponsorObjectivePrestigeCategoryPolicyEnabled(targetSeasonGameYear);
  const eligibleCandidates = sponsorPrestige === undefined
    ? allEligibleCandidates
    : selectPrestigeAlignedSponsorObjectiveRaceCandidates({
        candidates: allEligibleCandidates,
        sponsorPrestige,
        targetSeasonGameYear,
        minimumCount: count,
      });
  const normalizedContinentCode = (
    sponsorContinentCode ??
    eligibleCandidates.find(
      (candidate) =>
        candidate.countryCode.trim().toUpperCase() === normalizedCountryCode,
    )?.continentCode ??
    ""
  )
    .trim()
    .toLowerCase();
  const domesticCandidates = shuffleValues(
    eligibleCandidates.filter(
      (candidate) =>
        candidate.countryCode.trim().toUpperCase() === normalizedCountryCode
    ),
    random
  );
  const neighboringCandidates = shuffleValues(
    eligibleCandidates.filter((candidate) =>
      areSponsorCountriesNeighbors(
        normalizedCountryCode,
        candidate.countryCode,
      ),
    ),
    random,
  );
  const continentalCandidates = shuffleValues(
    eligibleCandidates.filter(
      (candidate) =>
        normalizedContinentCode !== "" &&
        candidate.countryCode.trim().toUpperCase() !== normalizedCountryCode &&
        !areSponsorCountriesNeighbors(
          normalizedCountryCode,
          candidate.countryCode,
        ) &&
        candidate.continentCode?.toLowerCase() === normalizedContinentCode,
    ),
    random,
  );
  const otherCandidates = shuffleValues(
    eligibleCandidates.filter(
      (candidate) =>
        candidate.countryCode.trim().toUpperCase() !== normalizedCountryCode &&
        !areSponsorCountriesNeighbors(
          normalizedCountryCode,
          candidate.countryCode,
        ) &&
        !continentalCandidates.some(
          (continentalCandidate) =>
            continentalCandidate.raceId === candidate.raceId,
        ),
    ),
    random
  );
  const geographicallyOrderedCandidates = [
    ...domesticCandidates,
    ...neighboringCandidates,
    ...continentalCandidates,
    ...otherCandidates,
  ];
  const selectedCandidates = categoryPolicyEnabled
    ? geographicallyOrderedCandidates
        .map((candidate, geographyIndex) => ({ candidate, geographyIndex }))
        .sort(
          (left, right) =>
            getSponsorObjectiveRaceCategoryTier(
              left.candidate,
              sponsorPrestige,
            ) -
              getSponsorObjectiveRaceCategoryTier(
                right.candidate,
                sponsorPrestige,
              ) ||
            left.geographyIndex - right.geographyIndex,
        )
        .map(({ candidate }) => candidate)
        .slice(0, count)
    : geographicallyOrderedCandidates.slice(0, count);

  if (selectedCandidates.length < count) {
    throw new Error(
      `Seulement ${selectedCandidates.length} course(s) existante(s) sont accessibles à cette équipe, alors que ${count} sont nécessaires pour les objectifs sponsor.`
    );
  }

  return selectedCandidates;
}

function createNationalityObjective(
  countryCode: string,
  minimumPercentage: number
): ObjectiveWithoutDisplayOrder {
  return {
    name:
      `Au moins ${minimumPercentage} % de coureurs ${countryCode}`,
    description:
      `À la fin de la saison, au moins ${minimumPercentage} % de l’effectif doit être composé de coureurs de nationalité ${countryCode}.`,
    objectiveType: "nationality_quota",
    priority: minimumPercentage >= 50
      ? "important"
      : "standard",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "nationality_quota",
      countryCode,
      minimumPercentage,
    },
  };
}

function createSeasonWinsObjective(
  minimumWinCount: number,
  winScope:
    | "all"
    | "one_day_races"
    | "stages"
    | "stage_race_general",
  label: string
): ObjectiveWithoutDisplayOrder {
  const scopeDescription =
    winScope === "one_day_races"
      ? "sur des courses d’un jour"
      : winScope === "stages"
        ? "sur des étapes de tours"
        : winScope === "stage_race_general"
          ? "au classement général de tours"
          : "toutes compétitions confondues";

  return {
    name: `${label} : ${minimumWinCount}`,
    description:
      `Obtenir au moins ${minimumWinCount} victoire(s) ${scopeDescription} pendant la saison.`,
    objectiveType: "season_wins",
    priority: minimumWinCount >= 5
      ? "important"
      : "standard",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "season_wins",
      minimumWinCount,
      winScope,
    },
  };
}

function createUciRankingObjective(
  targetRank: number
): ObjectiveWithoutDisplayOrder {
  return {
    name:
      `Terminer dans le top ${targetRank} du classement UCI`,
    description:
      `Terminer la saison au plus tard à la ${targetRank}e place du classement UCI par équipes.`,
    objectiveType: "uci_ranking",
    priority: targetRank <= 30
      ? "important"
      : "standard",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "uci_ranking",
      rankingScope: "teams",
      targetRank,
    },
  };
}


function createNationUciRankingObjective(
  countryCode: string,
  targetRank: number
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Hisser ${countryCode} dans le top ${targetRank} UCI`,
    description:
      `Faire terminer la nation ${countryCode} parmi les ${targetRank} premières du classement UCI des pays.`,
    objectiveType: "nation_uci_ranking",
    priority: "standard",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "nation_uci_ranking",
      countryCode,
      targetRank,
    },
  };
}

function createNationalChampionshipObjective(
  countryCode: string,
  championshipType: "any" | "road" | "time_trial",
): ObjectiveWithoutDisplayOrder {
  const championshipLabel = championshipType === "road"
    ? "sur route"
    : championshipType === "time_trial"
      ? "du contre-la-montre"
      : "national";
  const description = championshipType === "road"
    ? `Remporter le championnat national sur route du pays ${countryCode}.`
    : championshipType === "time_trial"
      ? `Remporter le championnat national du contre-la-montre du pays ${countryCode}.`
      : `Remporter le championnat national sur route ou contre-la-montre du pays ${countryCode}.`;

  return {
    name: `Décrocher le titre ${championshipLabel} ${countryCode}`,
    description,
    objectiveType: "national_championship",
    priority: "important",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "national_championship",
      countryCode,
      championshipType,
      requiredTitleCount: 1,
    },
  };
}

function createHomegrownRosterObjective(
  minimumPercentage: number
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Atteindre ${minimumPercentage} % de coureurs formés au club`,
    description:
      `Au moins ${minimumPercentage} % de l’effectif professionnel doit provenir de votre Centre de formation.`,
    objectiveType: "homegrown_roster",
    priority: "standard",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "homegrown_roster",
      minimumPercentage,
    },
  };
}

function createRiderRecruitmentObjective(
  rider: SponsorObjectiveRiderCandidate,
  accessibilityMaximumOverall: number,
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Recruter ${rider.riderName}`,
    description:
      `Faire signer ${rider.riderName}, coureur ${rider.countryCode} au profil ${rider.sportingProfile.toLowerCase()} (note générale ${rider.overallRating.toFixed(1)}), avant la fin de la saison.`,
    objectiveType: "rider_recruitment",
    priority: "important",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "rider_recruitment",
      riderId: rider.riderId,
      riderName: rider.riderName,
      countryCode: rider.countryCode,
      sportingProfile: rider.sportingProfile,
      overallRating: rider.overallRating,
      accessibilityMaximumOverall,
    },
  };
}

function createInfrastructureObjective(
  minimumCompletedCount: number
): ObjectiveWithoutDisplayOrder {
  return {
    name: "Faire grandir les installations",
    description:
      "Achever la construction ou l’amélioration d’au moins une infrastructure pendant la saison.",
    objectiveType: "infrastructure",
    priority: "optional",
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    satisfactionPoints: 0,
    renewalBonusPercent: 0,
    isProvisional: true,
    targetDetails: {
      kind: "infrastructure",
      minimumCompletedCount,
    },
  };
}

function getSeasonWinScopesForPhilosophy(
  philosophy: SponsorSportingPhilosophy,
): readonly ("all" | "one_day_races" | "stages")[] {
  switch (philosophy) {
    case "cobbled_classics":
    case "ardennes_classics":
      return ["one_day_races", "all"];
    case "medium_stage_races":
    case "grand_tour_general":
    case "time_trials":
      return ["stages", "all"];
    case "sprints":
      return ["stages", "one_day_races", "all"];
    case "national_preference":
    case "youth_development":
      return ["all", "one_day_races"];
  }
}

function getLegacyWinScopesForPhilosophy(
  philosophy: SponsorSportingPhilosophy,
): readonly (
  | "one_day_races"
  | "stages"
  | "stage_race_general"
)[] {
  switch (philosophy) {
    case "cobbled_classics":
    case "ardennes_classics":
    case "national_preference":
      return ["one_day_races"];
    case "medium_stage_races":
    case "grand_tour_general":
      return ["stage_race_general"];
    case "time_trials":
      return ["stages", "stage_race_general"];
    case "sprints":
      return ["stages", "one_day_races"];
    case "youth_development":
      return ["stage_race_general"];
  }
}

function getSeasonWinLabel(
  scope: "all" | "one_day_races" | "stages" | "stage_race_general",
): string {
  switch (scope) {
    case "all":
      return "Victoires sur la saison";
    case "one_day_races":
      return "Classiques remportées";
    case "stages":
      return "Victoires d’étape";
    case "stage_race_general":
      return "Tours remportés";
  }
}

function selectNationalChampionshipType({
  sportingPhilosophy,
  previousObjectives,
  random,
}: {
  sportingPhilosophy: SponsorSportingPhilosophy;
  previousObjectives: readonly SponsorObjectiveTargetDetails[];
  random: () => number;
}): "any" | "road" | "time_trial" {
  const candidates: readonly ("any" | "road" | "time_trial")[] =
    sportingPhilosophy === "time_trials"
      ? ["time_trial", "any"]
      : sportingPhilosophy === "cobbled_classics" ||
          sportingPhilosophy === "ardennes_classics" ||
          sportingPhilosophy === "sprints"
        ? ["road", "any"]
        : ["any", "road", "time_trial"];
  const previousTypes = previousObjectives.flatMap((objective) =>
    objective.kind === "national_championship"
      ? [objective.championshipType]
      : [],
  );

  return selectVariedValue(candidates, previousTypes, random);
}

function getNationUciRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousRanks: readonly number[] = [],
): number {
  const ranksByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 60,
    2: 50,
    3: 40,
    4: 30,
    5: 20,
    6: 10,
  };

  const baseRank = ranksByAmbition[ambitionLevel];
  const alternatives = [
    baseRank,
    Math.max(5, baseRank - 5),
    baseRank + 5,
  ];

  return selectVariedValue(alternatives, previousRanks, random);
}

function getTopRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousRanks: readonly number[] = [],
): number {
  const ranksByAmbition: Record<
    SponsorObjectiveAmbitionLevel,
    readonly number[]
  > = {
    1: [10, 12, 15],
    2: [8, 10, 12],
    3: [5, 8, 10],
    4: [3, 5, 8],
    5: [3, 5],
    6: [1, 3],
  };

  return selectVariedValue(
    ranksByAmbition[ambitionLevel],
    previousRanks,
    random,
  );
}

function getNationalityPercentageForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousPercentages: readonly number[] = [],
): number {
  const percentagesByAmbition: Record<
    SponsorObjectiveAmbitionLevel,
    readonly number[]
  > = {
    1: [30, 40],
    2: [30, 40, 50],
    3: [40, 50],
    4: [40, 50, 60],
    5: [50, 60],
    6: [60, 70],
  };

  return selectVariedValue(
    percentagesByAmbition[ambitionLevel],
    previousPercentages,
    random,
  );
}

function getNationalPreferencePercentageForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousPercentages: readonly number[] = [],
): number {
  const percentagesByAmbition: Record<
    SponsorObjectiveAmbitionLevel,
    readonly number[]
  > = {
    1: [50, 55],
    2: [55, 60],
    3: [60, 65],
    4: [65, 70],
    5: [70],
    6: [75, 80],
  };

  return selectVariedValue(
    percentagesByAmbition[ambitionLevel],
    previousPercentages,
    random,
  );
}

function getSeasonWinCountForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousCounts: readonly number[] = [],
): number {
  const minimum = ambitionLevel >= 6 ? 10 : ambitionLevel + 1;
  const maximum = ambitionLevel >= 6 ? 12 : ambitionLevel + 3;

  return selectVariedValue(
    Array.from(
      { length: maximum - minimum + 1 },
      (_, index) => minimum + index,
    ),
    previousCounts,
    random
  );
}

function getUciRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
  previousRanks: readonly number[] = [],
): number {
  const ranksByAmbition: Record<
    SponsorObjectiveAmbitionLevel,
    readonly number[]
  > = {
    1: [60, 70, 80],
    2: [50, 60, 70],
    3: [40, 50, 60],
    4: [30, 40, 50],
    5: [20, 30, 40],
    6: [3, 5, 10],
  };

  return selectVariedValue(
    ranksByAmbition[ambitionLevel],
    previousRanks,
    random,
  );
}

function getPriorityForRaceWin(
  ambitionLevel: SponsorObjectiveAmbitionLevel
): SponsorObjectivePriority {
  return ambitionLevel >= 4
    ? "mandatory"
    : "important";
}

function getPriorityForTopRank(
  targetRank: number
): SponsorObjectivePriority {
  if (targetRank <= 3) {
    return "important";
  }

  return "standard";
}

function selectRandomValue<T>(
  values: readonly T[],
  random: () => number
): T {
  if (values.length === 0) {
    throw new Error(
      "Impossible de sélectionner une valeur dans un tableau vide."
    );
  }

  const randomIndex = Math.min(
    values.length - 1,
    Math.floor(random() * values.length)
  );

  return values[randomIndex];
}

function selectVariedValue<T>(
  values: readonly T[],
  previousValues: readonly T[],
  random: () => number,
): T {
  const previous = new Set(previousValues);
  const freshValues = values.filter((value) => !previous.has(value));

  return selectRandomValue(
    freshValues.length > 0 ? freshValues : values,
    random,
  );
}

function shuffleValues<T>(
  values: readonly T[],
  random: () => number
): T[] {
  const shuffledValues = [...values];

  for (
    let index = shuffledValues.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.min(
      index,
      Math.floor(random() * (index + 1))
    );

    [
      shuffledValues[index],
      shuffledValues[randomIndex],
    ] = [
      shuffledValues[randomIndex],
      shuffledValues[index],
    ];
  }

  return shuffledValues;
}
