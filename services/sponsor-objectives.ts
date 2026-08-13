import type {
  GeneratedSponsorObjective,
  SponsorObjectivePriority,
} from "@/types/sponsor-objective";
import type {
  SponsorPrestige,
} from "@/types/sponsor";

const OBJECTIVE_COUNT = 10;
const MAXIMUM_RENEWAL_BONUS_PERCENT = 7;

export type SponsorObjectiveRaceCandidate = {
  raceId: string;
  raceEditionId: string | null;
  raceSlug: string;
  raceLabel: string;
  countryCode: string;
  registrationPolicy: "open" | "criteria_pending" | "closed";
  minimumReputation: number | null;
  raceFormat?: "one_day" | "stage_race";
  competitionType?: string;
  isMonument?: boolean;
  isGrandTour?: boolean;
};

type GenerateSponsorObjectivesOptions = {
  sponsorCountryCode: string;
  sponsorPrestige: SponsorPrestige;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  sponsorCatalogKey?: string;
  sponsorSector?: string;
  relationshipYear?: number;
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
  teamReputationPoints,
  raceCandidates,
  sponsorCatalogKey = "",
  sponsorSector = "",
  relationshipYear = 1,
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
  const weights = SATISFACTION_WEIGHTS[focus];
  const portfolio = selectSponsorObjectivePortfolio({
    sponsorCountryCode: normalizedCountryCode,
    teamReputationPoints,
    raceCandidates,
    includePrestigeRaces: sponsorPrestige >= 4,
    random,
  });
  const firstTopRank = getTopRankForPrestige(sponsorPrestige, random);
  const secondTopRank = getTopRankForPrestige(sponsorPrestige, random);
  const nationalityPercentage = getNationalityPercentageForPrestige(
    sponsorPrestige,
    random
  );
  const minimumSeasonWinCount = getSeasonWinCountForPrestige(
    sponsorPrestige,
    random
  );
  const minimumOneDayWinCount = getOneDayWinCountForPrestige(
    sponsorPrestige,
    random
  );
  const targetUciRank = getUciRankForPrestige(sponsorPrestige, random);
  const normalizedRelationshipYear = Math.max(1, Math.floor(relationshipYear));
  const includeFormation = normalizedRelationshipYear >= 2;
  const includeInfrastructure =
    sponsorPrestige < 4 &&
    !includeFormation &&
    stableSponsorBucket(sponsorCatalogKey || normalizedCountryCode, 6) === 0;

  const domesticRaceObjective =
    sponsorPrestige >= 4
      ? createRaceWinObjective(
          portfolio.domestic,
          getPriorityForRaceWin(sponsorPrestige)
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

  const ambitionObjective =
    sponsorPrestige >= 4 && portfolio.monument
      ? createRaceWinObjective(portfolio.monument, "mandatory")
      : includeFormation
        ? createHomegrownRosterObjective(10)
        : createSeasonWinsObjective(
            Math.max(1, sponsorPrestige),
            "stages",
            "Victoires d’étape"
          );

  const legacyObjective =
    sponsorPrestige >= 4 && portfolio.grandTour
      ? sponsorPrestige === 5
        ? createRaceWinObjective(portfolio.grandTour, "mandatory")
        : createRaceTopObjective(portfolio.grandTour, 3, "important")
      : includeInfrastructure
        ? createInfrastructureObjective(1)
        : createSeasonWinsObjective(
            Math.max(1, Math.ceil(sponsorPrestige / 2)),
            "stage_race_general",
            "Tours remportés"
          );

  const objectives = [
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
      createSeasonWinsObjective(
        minimumOneDayWinCount,
        "one_day_races",
        "Victoires sur les courses d’un jour"
      ),
      weights.specialtyWins
    ),
    withSatisfactionPoints(
      createUciRankingObjective(targetUciRank),
      weights.teamRanking
    ),
    withSatisfactionPoints(
      createNationUciRankingObjective(
        normalizedCountryCode,
        getNationUciRankForPrestige(sponsorPrestige)
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
  }));
}

function withSatisfactionPoints(
  objective: ObjectiveWithoutDisplayOrder,
  satisfactionPoints: number
): ObjectiveWithoutDisplayOrder {
  return {
    ...objective,
    satisfactionPoints,
    priority: getPriorityForSatisfactionPoints(satisfactionPoints),
    renewalBonusPercent: Number(
      (
        satisfactionPoints *
        (MAXIMUM_RENEWAL_BONUS_PERCENT / 100)
      ).toFixed(2)
    ),
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
  teamReputationPoints,
  raceCandidates,
  includePrestigeRaces,
  random,
}: {
  sponsorCountryCode: string;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  includePrestigeRaces: boolean;
  random: () => number;
}): {
  domestic: SponsorObjectiveRaceCandidate;
  regional: SponsorObjectiveRaceCandidate;
  monument: SponsorObjectiveRaceCandidate | null;
  grandTour: SponsorObjectiveRaceCandidate | null;
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
  const canReservePrestigeRaces = includePrestigeRaces && eligible.length >= 4;
  const monument = canReservePrestigeRaces
    ? take((candidate) => candidate.isMonument === true)
    : null;
  const grandTour = canReservePrestigeRaces
    ? take((candidate) => candidate.isGrandTour === true)
    : null;

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
    takeAny();

  const regional =
    take((candidate) =>
      areSponsorCountriesNeighbors(
        normalizedCountryCode,
        candidate.countryCode
      )
    ) ??
    take(
      (candidate) =>
        candidate.countryCode.toUpperCase() !== normalizedCountryCode
    ) ??
    takeAny();

  if (!domestic || !regional) {
    throw new Error(
      "Au moins deux courses accessibles sont nécessaires pour les objectifs sponsor."
    );
  }

  return {
    domestic,
    regional,
    monument,
    grandTour,
  };
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
      normalizedReputation < candidate.minimumReputation
    ) {
      continue;
    }

    if (!uniqueCandidates.has(candidate.raceId)) {
      uniqueCandidates.set(candidate.raceId, candidate);
    }
  }

  return [...uniqueCandidates.values()];
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
  teamReputationPoints,
  raceCandidates,
  count,
  random = Math.random,
}: {
  sponsorCountryCode: string;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  count: number;
  random?: () => number;
}): SponsorObjectiveRaceCandidate[] {
  const normalizedCountryCode = sponsorCountryCode.trim().toUpperCase();
  const normalizedReputation = Math.max(0, Math.floor(teamReputationPoints));
  const uniqueCandidates = new Map<string, SponsorObjectiveRaceCandidate>();

  for (const candidate of raceCandidates) {
    if (
      candidate.registrationPolicy !== "open" ||
      candidate.minimumReputation === null ||
      normalizedReputation < candidate.minimumReputation
    ) {
      continue;
    }

    if (!uniqueCandidates.has(candidate.raceId)) {
      uniqueCandidates.set(candidate.raceId, candidate);
    }
  }

  const eligibleCandidates = [...uniqueCandidates.values()];
  const domesticCandidates = shuffleValues(
    eligibleCandidates.filter(
      (candidate) =>
        candidate.countryCode.trim().toUpperCase() === normalizedCountryCode
    ),
    random
  );
  const otherCandidates = shuffleValues(
    eligibleCandidates.filter(
      (candidate) =>
        candidate.countryCode.trim().toUpperCase() !== normalizedCountryCode
    ),
    random
  );
  const selectedCandidates = [
    ...domesticCandidates,
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

function getNationUciRankForPrestige(
  prestige: SponsorPrestige
): number {
  const ranksByPrestige: Record<SponsorPrestige, number> = {
    1: 60,
    2: 50,
    3: 40,
    4: 30,
    5: 20,
  };

  return ranksByPrestige[prestige];
}

function getTopRankForPrestige(
  prestige: SponsorPrestige,
  random: () => number
): number {
  const ranksByPrestige: Record<
    SponsorPrestige,
    readonly number[]
  > = {
    1: [10, 12, 15],
    2: [8, 10, 12],
    3: [5, 8, 10],
    4: [3, 5, 8],
    5: [3, 5],
  };

  return selectRandomValue(
    ranksByPrestige[prestige],
    random
  );
}

function getNationalityPercentageForPrestige(
  prestige: SponsorPrestige,
  random: () => number
): number {
  const percentagesByPrestige: Record<
    SponsorPrestige,
    readonly number[]
  > = {
    1: [30, 40],
    2: [30, 40, 50],
    3: [40, 50],
    4: [40, 50, 60],
    5: [50, 60],
  };

  return selectRandomValue(
    percentagesByPrestige[prestige],
    random
  );
}

function getSeasonWinCountForPrestige(
  prestige: SponsorPrestige,
  random: () => number
): number {
  const minimum = prestige + 1;
  const maximum = prestige + 3;

  return getRandomInteger(
    minimum,
    maximum,
    random
  );
}

function getOneDayWinCountForPrestige(
  prestige: SponsorPrestige,
  random: () => number
): number {
  const minimum = Math.max(
    1,
    Math.ceil(prestige / 2)
  );

  return getRandomInteger(
    minimum,
    minimum + 1,
    random
  );
}

function getUciRankForPrestige(
  prestige: SponsorPrestige,
  random: () => number
): number {
  const ranksByPrestige: Record<
    SponsorPrestige,
    readonly number[]
  > = {
    1: [60, 70, 80],
    2: [50, 60, 70],
    3: [40, 50, 60],
    4: [30, 40, 50],
    5: [20, 30, 40],
  };

  return selectRandomValue(
    ranksByPrestige[prestige],
    random
  );
}

function getPriorityForRaceWin(
  prestige: SponsorPrestige
): SponsorObjectivePriority {
  return prestige >= 4
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
