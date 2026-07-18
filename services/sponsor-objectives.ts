import type {
  GeneratedSponsorObjective,
  SponsorObjectivePriority,
} from "@/types/sponsor-objective";
import type {
  SponsorPrestige,
} from "@/types/sponsor";

const OBJECTIVE_COUNT = 7;
const RENEWAL_BONUS_PERCENT = 1;

const PROVISIONAL_RACE_LABELS = [
  "Course X",
  "Course Y",
  "Course Z",
  "Classique A",
  "Classique B",
  "Grand Prix A",
  "Grand Prix B",
  "Tour X",
  "Tour Y",
  "Tour Z",
] as const;

type GenerateSponsorObjectivesOptions = {
  sponsorCountryCode: string;
  sponsorPrestige: SponsorPrestige;
  random?: () => number;
};

type ObjectiveWithoutDisplayOrder = Omit<
  GeneratedSponsorObjective,
  "displayOrder"
>;

export function generateProvisionalSponsorObjectives({
  sponsorCountryCode,
  sponsorPrestige,
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

  const raceLabels = selectUniqueValues(
    PROVISIONAL_RACE_LABELS,
    3,
    random
  );

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
      raceLabels[0],
      getPriorityForRaceWin(sponsorPrestige)
    ),

    createRaceTopObjective(
      raceLabels[1],
      firstTopRank,
      getPriorityForTopRank(firstTopRank)
    ),

    createRaceTopObjective(
      raceLabels[2],
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
  raceLabel: string,
  priority: SponsorObjectivePriority
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Remporter ${raceLabel}`,
    description:
      `Obtenir la victoire sur ${raceLabel} pendant la saison.`,
    objectiveType: "race_result",
    priority,
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
    isProvisional: true,
    targetDetails: {
      kind: "race_result",
      raceLabel,
      achievementType: "win",
      targetRank: null,
      requiredCount: 1,
    },
  };
}

function createRaceTopObjective(
  raceLabel: string,
  targetRank: number,
  priority: SponsorObjectivePriority
): ObjectiveWithoutDisplayOrder {
  return {
    name: `Top ${targetRank} sur ${raceLabel}`,
    description:
      `Placer au moins un coureur parmi les ${targetRank} premiers de ${raceLabel}.`,
    objectiveType: "race_result",
    priority,
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    renewalBonusPercent: RENEWAL_BONUS_PERCENT,
    isProvisional: true,
    targetDetails: {
      kind: "race_result",
      raceLabel,
      achievementType: "top_n",
      targetRank,
      requiredCount: 1,
    },
  };
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

function selectUniqueValues<T>(
  values: readonly T[],
  count: number,
  random: () => number
): T[] {
  if (count > values.length) {
    throw new Error(
      "Le nombre de valeurs demandé dépasse la taille du catalogue."
    );
  }

  return shuffleValues(values, random).slice(
    0,
    count
  );
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