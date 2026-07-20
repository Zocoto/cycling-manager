import type {
  GeneratedSponsorObjective,
  SponsorObjectivePriority,
} from "@/types/sponsor-objective";
import type {
  SponsorPrestige,
} from "@/types/sponsor";

const OBJECTIVE_COUNT = 7;
const RENEWAL_BONUS_PERCENT = 1;

export type SponsorObjectiveRaceCandidate = {
  raceId: string;
  raceEditionId: string | null;
  raceSlug: string;
  raceLabel: string;
  countryCode: string;
  registrationPolicy: "open" | "criteria_pending" | "closed";
  minimumReputation: number | null;
};

type GenerateSponsorObjectivesOptions = {
  sponsorCountryCode: string;
  sponsorPrestige: SponsorPrestige;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  random?: () => number;
};

type ObjectiveWithoutDisplayOrder = Omit<
  GeneratedSponsorObjective,
  "displayOrder"
>;

export function generateProvisionalSponsorObjectives({
  sponsorCountryCode,
  sponsorPrestige,
  teamReputationPoints,
  raceCandidates,
  random = Math.random,
}: GenerateSponsorObjectivesOptions): GeneratedSponsorObjective[] {
  const normalizedCountryCode = sponsorCountryCode
    .trim()
    .toUpperCase();

  if (!normalizedCountryCode) {
    throw new Error(
      "Le code pays du sponsor est obligatoire pour générer ses objectifs."
    );
  }

  const selectedRaces = selectSponsorObjectiveRaces({
    sponsorCountryCode: normalizedCountryCode,
    teamReputationPoints,
    raceCandidates,
    count: 3,
    random,
  });

  const firstTopRank = getTopRankForPrestige(
    sponsorPrestige,
    random
  );

  const secondTopRank = getTopRankForPrestige(
    sponsorPrestige,
    random
  );

  const nationalityPercentage =
    getNationalityPercentageForPrestige(
      sponsorPrestige,
      random
    );

  const minimumSeasonWinCount =
    getSeasonWinCountForPrestige(
      sponsorPrestige,
      random
    );

  const minimumOneDayWinCount =
    getOneDayWinCountForPrestige(
      sponsorPrestige,
      random
    );

  const targetUciRank = getUciRankForPrestige(
    sponsorPrestige,
    random
  );

  const objectives: ObjectiveWithoutDisplayOrder[] = [
    createRaceWinObjective(
      selectedRaces[0],
      getPriorityForRaceWin(sponsorPrestige)
    ),

    createRaceTopObjective(
      selectedRaces[1],
      firstTopRank,
      getPriorityForTopRank(firstTopRank)
    ),

    createRaceTopObjective(
      selectedRaces[2],
      secondTopRank,
      getPriorityForTopRank(secondTopRank)
    ),

    createNationalityObjective(
      normalizedCountryCode,
      nationalityPercentage
    ),

    createSeasonWinsObjective(
      minimumSeasonWinCount,
      "all",
      "Victoires sur la saison"
    ),

    createSeasonWinsObjective(
      minimumOneDayWinCount,
      "one_day_races",
      "Victoires sur les courses d’un jour"
    ),

    createUciRankingObjective(targetUciRank),
  ];

  const shuffledObjectives = shuffleValues(
    objectives,
    random
  );

  if (shuffledObjectives.length !== OBJECTIVE_COUNT) {
    throw new Error(
      `Le générateur doit produire exactement ${OBJECTIVE_COUNT} objectifs.`
    );
  }

  return shuffledObjectives.map(
    (objective, index) => ({
      ...objective,
      displayOrder: index + 1,
    })
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
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
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
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
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
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
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
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
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
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
    isProvisional: true,
    targetDetails: {
      kind: "uci_ranking",
      rankingScope: "teams",
      targetRank,
    },
  };
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
