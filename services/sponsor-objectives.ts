import type {
  GeneratedSponsorObjective,
  SponsorObjectiveAmbitionLevel,
  SponsorObjectivePriority,
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
const SPONSOR_OBJECTIVE_GENERATION_VERSION = 8;

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
  includeRiderRecruitmentObjective?: boolean;
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
  includeRiderRecruitmentObjective = false,
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
  const portfolio = selectSponsorObjectivePortfolio({
    sponsorCountryCode: normalizedCountryCode,
    sponsorContinentCode,
    sportingPhilosophy,
    ambitionLevel,
    teamReputationPoints,
    raceCandidates,
    random,
  });
  const firstTopRank = getTopRankForAmbition(ambitionLevel, random);
  const secondTopRank = getTopRankForAmbition(ambitionLevel, random);
  const nationalityPercentage = sportingPhilosophy === "national_preference"
    ? getNationalPreferencePercentageForAmbition(ambitionLevel, random)
    : getNationalityPercentageForAmbition(ambitionLevel, random);
  const minimumSeasonWinCount = getSeasonWinCountForAmbition(
    ambitionLevel,
    random
  );
  const targetUciRank = getUciRankForAmbition(ambitionLevel, random);
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

  const ambitionObjective =
    recruitmentCandidate
      ? createRiderRecruitmentObjective(
          recruitmentCandidate,
          resolveSponsorRecruitmentOverallRange(teamReputationPoints).maximum,
        )
      : includeFormation
      ? createHomegrownRosterObjective(
          Math.min(30, ambitionLevel * 5),
        )
      : portfolio.philosophySecondary
      ? createPhilosophyRaceObjective({
          race: portfolio.philosophySecondary,
          ambitionLevel,
          random,
        })
      : createSeasonWinsObjective(
            Math.max(1, ambitionLevel),
            "stages",
            "Victoires d’étape"
          );

  const legacyObjective =
    includeInfrastructure
        ? createInfrastructureObjective(1)
        : createSeasonWinsObjective(
            Math.max(1, Math.ceil(ambitionLevel / 2)),
            "stage_race_general",
            "Tours remportés"
          );

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
            "all",
            "Victoires sur la saison"
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
            getNationUciRankForAmbition(ambitionLevel)
          ),
          weights.nationRanking
        ),
        withSatisfactionPoints(
          createNationalChampionshipObjective(normalizedCountryCode),
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
  teamReputationPoints,
  raceCandidates,
  random,
}: {
  sponsorCountryCode: string;
  sponsorContinentCode: string | null;
  sportingPhilosophy: SponsorSportingPhilosophy;
  ambitionLevel: SponsorObjectiveAmbitionLevel;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
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
  const usedRaceIds = new Set<string>();
  const take = (
    predicate: (candidate: SponsorObjectiveRaceCandidate) => boolean
  ): SponsorObjectiveRaceCandidate | null => {
    const candidate = shuffleValues(
      eligible.filter(
        (entry) => !usedRaceIds.has(entry.raceId) && predicate(entry)
      ),
      random
    )[0];

    if (candidate) usedRaceIds.add(candidate.raceId);
    return candidate ?? null;
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
  ): SponsorObjectiveRaceCandidate | null =>
    take(
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

  const philosophySecondary = takeByGeography(philosophyPredicate);

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
    if (
      candidate.registrationPolicy !== "open" ||
      candidate.minimumReputation === null ||
      normalizedReputation < candidate.minimumReputation ||
      !isRaceCategoryUnlockedForSponsorObjectives(
        candidate.categoryCode,
        normalizedReputation,
      )
    ) {
      continue;
    }

    if (!uniqueCandidates.has(candidate.raceId)) {
      uniqueCandidates.set(candidate.raceId, candidate);
    }
  }

  return [...uniqueCandidates.values()];
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
  teamReputationPoints,
  raceCandidates,
  count,
  random = Math.random,
}: {
  sponsorCountryCode: string;
  sponsorContinentCode?: string | null;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  count: number;
  random?: () => number;
}): SponsorObjectiveRaceCandidate[] {
  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();
  const eligibleCandidates = getEligibleSponsorObjectiveRaces({
    teamReputationPoints,
    raceCandidates,
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
  const selectedCandidates = [
    ...domesticCandidates,
    ...neighboringCandidates,
    ...continentalCandidates,
    ...otherCandidates,
  ].slice(0, count);

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
  countryCode: string
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Décrocher un titre national ${countryCode}`,
    description:
      `Remporter le championnat national sur route ou contre-la-montre du pays ${countryCode}.`,
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
      championshipType: "any",
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

function getNationUciRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel
): number {
  const ranksByAmbition: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 60,
    2: 50,
    3: 40,
    4: 30,
    5: 20,
    6: 10,
  };

  return ranksByAmbition[ambitionLevel];
}

function getTopRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number
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

  return selectRandomValue(
    ranksByAmbition[ambitionLevel],
    random
  );
}

function getNationalityPercentageForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number
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

  return selectRandomValue(
    percentagesByAmbition[ambitionLevel],
    random
  );
}

function getNationalPreferencePercentageForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number,
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

  return selectRandomValue(percentagesByAmbition[ambitionLevel], random);
}

function getSeasonWinCountForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number
): number {
  const minimum = ambitionLevel >= 6 ? 10 : ambitionLevel + 1;
  const maximum = ambitionLevel >= 6 ? 12 : ambitionLevel + 3;

  return getRandomInteger(
    minimum,
    maximum,
    random
  );
}

function getUciRankForAmbition(
  ambitionLevel: SponsorObjectiveAmbitionLevel,
  random: () => number
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

  return selectRandomValue(
    ranksByAmbition[ambitionLevel],
    random
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

function getRandomInteger(
  minimum: number,
  maximum: number,
  random: () => number
): number {
  return (
    Math.floor(
      random() * (maximum - minimum + 1)
    ) + minimum
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
