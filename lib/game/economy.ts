export type RaceTier =
  | "regional"
  | "national"
  | "continental"
  | "world"
  | "elite";

export type RaceRewardScope = "one_day" | "tour" | "grand_tour";

export type SecondaryClassification = "mountain" | "sprint" | "youth" | "team";

export type RaceRewardInput = {
  tier: RaceTier;
  scope: RaceRewardScope;
  finalRank: number | null;
  gameYear?: number;
  secondaryClassifications?: SecondaryClassification[];
  mountainPrimesWon?: number;
  intermediateSprintsWon?: number;
};

export type RaceReward = {
  reputation: number;
  experience: number;
  cashPrize: number;
  uciPoints: number;
};

export type RaceRewardComponent = RaceReward & {
  type:
    | "general"
    | "mountain_classification"
    | "sprint_classification"
    | "youth_classification"
    | "team_classification"
    | "mountain_prime"
    | "intermediate_sprint";
  count: number;
};

export type RaceRewardBreakdown = {
  total: RaceReward;
  components: RaceRewardComponent[];
};

export type StagePrizeInput = {
  tier: RaceTier;
  finalRank: number | null;
  gameYear?: number;
};

export type NationalChampionshipRewardInput = {
  finalRank: number | null;
  gameYear?: number;
};

export type InternationalChampionshipRewardInput = {
  competitionType: "continental_championship" | "world_championship";
  finalRank: number | null;
  gameYear?: number;
};

type PlacementRule = {
  maxRank: number;
  reputation: number;
  experience: number;
  cashPrize: number;
  uciPoints: number;
};

type RewardScale = {
  placements: PlacementRule[];
  secondaryReputation: number;
  secondaryExperience: number;
  secondaryCashPrize: number;
  secondaryUciPoints: number;
  primeExperience: number;
  primeCashPrize: number;
  primeUciPoints: number;
};

type StagePrizeRule = {
  maxRank: number;
  experience?: number;
  cashPrize: number;
  uciPoints: number;
};

export const EXPANDED_RACE_REWARDS_START_GAME_YEAR = 4;

const LEGACY_STAGE_PRIZE_SCALES: Record<RaceTier, StagePrizeRule[]> = {
  regional: [
    { maxRank: 1, cashPrize: 600, uciPoints: 10 },
    { maxRank: 2, cashPrize: 350, uciPoints: 6 },
    { maxRank: 3, cashPrize: 200, uciPoints: 4 },
    { maxRank: 5, cashPrize: 100, uciPoints: 2 },
  ],
  national: [
    { maxRank: 1, cashPrize: 1_200, uciPoints: 18 },
    { maxRank: 2, cashPrize: 700, uciPoints: 10 },
    { maxRank: 3, cashPrize: 400, uciPoints: 6 },
    { maxRank: 5, cashPrize: 150, uciPoints: 3 },
  ],
  continental: [
    { maxRank: 1, cashPrize: 1_800, uciPoints: 25 },
    { maxRank: 2, cashPrize: 1_000, uciPoints: 15 },
    { maxRank: 3, cashPrize: 600, uciPoints: 10 },
    { maxRank: 5, cashPrize: 250, uciPoints: 5 },
  ],
  world: [
    { maxRank: 1, cashPrize: 5_000, uciPoints: 60 },
    { maxRank: 2, cashPrize: 3_000, uciPoints: 40 },
    { maxRank: 3, cashPrize: 1_800, uciPoints: 25 },
    { maxRank: 5, cashPrize: 750, uciPoints: 12 },
    { maxRank: 10, cashPrize: 250, uciPoints: 5 },
  ],
  elite: [
    { maxRank: 1, cashPrize: 12_000, uciPoints: 120 },
    { maxRank: 2, cashPrize: 7_000, uciPoints: 80 },
    { maxRank: 3, cashPrize: 4_000, uciPoints: 50 },
    { maxRank: 5, cashPrize: 1_800, uciPoints: 25 },
    { maxRank: 10, cashPrize: 500, uciPoints: 10 },
  ],
};

const LEGACY_REWARD_SCALES: Record<
  RaceTier,
  Record<RaceRewardScope, RewardScale>
> = {
  regional: {
    one_day: createScale({
      placements: [
        [1, 1, 35, 1_200, 25],
        [2, 0, 22, 700, 15],
        [3, 0, 15, 400, 10],
        [5, 0, 10, 150, 6],
        [10, 0, 6, 0, 2],
      ],
      secondary: [1, 25, 500, 12],
      prime: [4, 75, 2],
    }),
    tour: createScale({
      placements: [
        [1, 2, 65, 3_000, 50],
        [2, 1, 45, 1_800, 35],
        [3, 0, 30, 1_000, 25],
        [5, 0, 20, 400, 15],
        [10, 0, 10, 0, 5],
      ],
      secondary: [1, 30, 700, 18],
      prime: [4, 75, 2],
    }),
    grand_tour: createScale({
      placements: [[1, 2, 65, 3_000, 50]],
      secondary: [1, 30, 700, 18],
      prime: [4, 75, 2],
    }),
  },
  national: {
    one_day: createScale({
      placements: [
        [1, 2, 50, 2_500, 40],
        [2, 1, 32, 1_400, 25],
        [3, 0, 22, 800, 16],
        [5, 0, 14, 300, 10],
        [10, 0, 8, 0, 3],
      ],
      secondary: [1, 35, 800, 18],
      prime: [5, 100, 2],
    }),
    tour: createScale({
      placements: [
        [1, 3, 85, 6_000, 80],
        [2, 2, 58, 3_500, 55],
        [3, 1, 40, 2_000, 38],
        [5, 0, 25, 750, 22],
        [10, 0, 12, 0, 7],
      ],
      secondary: [2, 42, 1_200, 25],
      prime: [5, 100, 2],
    }),
    grand_tour: createScale({
      placements: [[1, 3, 85, 6_000, 80]],
      secondary: [2, 42, 1_200, 25],
      prime: [5, 100, 2],
    }),
  },
  continental: {
    one_day: createScale({
      placements: [
        [1, 2, 65, 4_000, 60],
        [2, 1, 42, 2_400, 40],
        [3, 0, 30, 1_400, 30],
        [5, 0, 18, 500, 18],
        [10, 0, 10, 0, 6],
      ],
      secondary: [2, 45, 1_200, 25],
      prime: [6, 125, 3],
    }),
    tour: createScale({
      placements: [
        [1, 3, 100, 9_000, 120],
        [2, 2, 70, 5_500, 80],
        [3, 1, 50, 3_200, 55],
        [5, 0, 30, 1_200, 30],
        [10, 0, 15, 0, 10],
      ],
      secondary: [2, 55, 1_800, 35],
      prime: [6, 125, 3],
    }),
    grand_tour: createScale({
      placements: [[1, 3, 100, 9_000, 120]],
      secondary: [2, 55, 1_800, 35],
      prime: [6, 125, 3],
    }),
  },
  world: {
    one_day: createScale({
      placements: [
        [1, 3, 105, 12_000, 150],
        [2, 1, 70, 7_000, 100],
        [3, 0, 50, 4_000, 70],
        [5, 0, 30, 1_500, 40],
        [10, 0, 16, 0, 15],
      ],
      secondary: [3, 70, 3_000, 50],
      prime: [8, 250, 5],
    }),
    tour: createScale({
      placements: [
        [1, 5, 175, 25_000, 300],
        [2, 3, 120, 15_000, 210],
        [5, 2, 80, 7_000, 120],
        [10, 1, 40, 2_000, 45],
        [20, 0, 18, 0, 15],
      ],
      secondary: [3, 85, 4_500, 70],
      prime: [8, 250, 5],
    }),
    grand_tour: createScale({
      placements: [[1, 5, 175, 25_000, 300]],
      secondary: [3, 85, 4_500, 70],
      prime: [8, 250, 5],
    }),
  },
  elite: {
    one_day: createScale({
      placements: [
        [1, 10, 300, 30_000, 500],
        [2, 3, 170, 18_000, 350],
        [3, 1, 110, 10_000, 250],
        [5, 0, 70, 4_000, 160],
        [10, 0, 35, 1_000, 70],
        [20, 0, 15, 0, 25],
      ],
      secondary: [3, 100, 6_000, 100],
      prime: [12, 500, 8],
    }),
    tour: createScale({
      placements: [
        [1, 12, 360, 60_000, 700],
        [2, 6, 240, 36_000, 500],
        [3, 3, 170, 22_000, 360],
        [10, 2, 80, 6_000, 150],
        [20, 0, 35, 0, 55],
      ],
      secondary: [3, 120, 9_000, 140],
      prime: [12, 500, 8],
    }),
    grand_tour: createScale({
      placements: [
        [1, 25, 750, 120_000, 1_200],
        [2, 20, 570, 80_000, 900],
        [5, 10, 350, 40_000, 600],
        [10, 5, 190, 15_000, 300],
        [20, 2, 85, 4_000, 120],
        [40, 0, 35, 0, 40],
      ],
      secondary: [10, 300, 20_000, 300],
      prime: [15, 750, 12],
    }),
  },
};

/**
 * À partir de la saison 4, les barèmes privilégient la profondeur : la hausse
 * au sommet reste mesurée, tandis que davantage de coureurs marquent des
 * points, gagnent de l'XP et rapportent une prime à leur équipe. L'élargissement
 * est volontairement le plus fort en catégorie Nationale, où la densité des
 * équipes rendait les revenus de course trop rares.
 */
const SEASON_FOUR_STAGE_PRIZE_SCALES: Record<RaceTier, StagePrizeRule[]> = {
  regional: [
    { maxRank: 1, experience: 8, cashPrize: 750, uciPoints: 12 },
    { maxRank: 2, experience: 5, cashPrize: 450, uciPoints: 7 },
    { maxRank: 3, experience: 3, cashPrize: 250, uciPoints: 5 },
    { maxRank: 5, experience: 2, cashPrize: 125, uciPoints: 3 },
    { maxRank: 10, experience: 1, cashPrize: 50, uciPoints: 1 },
  ],
  national: [
    { maxRank: 1, experience: 15, cashPrize: 1_500, uciPoints: 20 },
    { maxRank: 2, experience: 10, cashPrize: 900, uciPoints: 12 },
    { maxRank: 3, experience: 7, cashPrize: 550, uciPoints: 8 },
    { maxRank: 5, experience: 4, cashPrize: 300, uciPoints: 5 },
    { maxRank: 10, experience: 2, cashPrize: 125, uciPoints: 2 },
  ],
  continental: [
    { maxRank: 1, experience: 20, cashPrize: 2_200, uciPoints: 30 },
    { maxRank: 2, experience: 14, cashPrize: 1_300, uciPoints: 18 },
    { maxRank: 3, experience: 9, cashPrize: 800, uciPoints: 12 },
    { maxRank: 5, experience: 5, cashPrize: 400, uciPoints: 7 },
    { maxRank: 10, experience: 3, cashPrize: 175, uciPoints: 3 },
  ],
  world: [
    { maxRank: 1, experience: 30, cashPrize: 6_000, uciPoints: 70 },
    { maxRank: 2, experience: 20, cashPrize: 3_600, uciPoints: 45 },
    { maxRank: 3, experience: 14, cashPrize: 2_200, uciPoints: 30 },
    { maxRank: 5, experience: 8, cashPrize: 1_000, uciPoints: 15 },
    { maxRank: 10, experience: 4, cashPrize: 400, uciPoints: 7 },
    { maxRank: 15, experience: 2, cashPrize: 150, uciPoints: 3 },
  ],
  elite: [
    { maxRank: 1, experience: 50, cashPrize: 14_000, uciPoints: 140 },
    { maxRank: 2, experience: 34, cashPrize: 8_500, uciPoints: 90 },
    { maxRank: 3, experience: 24, cashPrize: 5_000, uciPoints: 60 },
    { maxRank: 5, experience: 14, cashPrize: 2_200, uciPoints: 30 },
    { maxRank: 10, experience: 7, cashPrize: 750, uciPoints: 12 },
    { maxRank: 15, experience: 3, cashPrize: 300, uciPoints: 5 },
  ],
};

const SEASON_FOUR_REWARD_SCALES: Record<
  RaceTier,
  Record<RaceRewardScope, RewardScale>
> = {
  regional: {
    one_day: createScale({
      placements: [
        [1, 1, 42, 1_500, 28],
        [2, 0, 28, 900, 17],
        [3, 0, 20, 550, 12],
        [5, 0, 14, 300, 7],
        [10, 0, 9, 125, 3],
        [15, 0, 6, 75, 2],
        [20, 0, 4, 40, 1],
      ],
      secondary: [1, 30, 600, 14],
      prime: [5, 90, 2],
    }),
    tour: createScale({
      placements: [
        [1, 2, 78, 3_750, 58],
        [2, 1, 55, 2_250, 40],
        [3, 0, 38, 1_350, 28],
        [5, 0, 26, 600, 18],
        [10, 0, 15, 250, 8],
        [15, 0, 9, 125, 4],
        [20, 0, 6, 60, 2],
      ],
      secondary: [1, 36, 850, 20],
      prime: [5, 90, 2],
    }),
    grand_tour: createScale({
      placements: [
        [1, 2, 78, 3_750, 58],
        [2, 1, 55, 2_250, 40],
        [3, 0, 38, 1_350, 28],
        [5, 0, 26, 600, 18],
        [10, 0, 15, 250, 8],
        [15, 0, 9, 125, 4],
        [20, 0, 6, 60, 2],
      ],
      secondary: [1, 36, 850, 20],
      prime: [5, 90, 2],
    }),
  },
  national: {
    one_day: createScale({
      placements: [
        [1, 2, 60, 3_200, 45],
        [2, 1, 42, 2_000, 30],
        [3, 0, 30, 1_250, 20],
        [5, 0, 20, 700, 12],
        [10, 0, 12, 300, 6],
        [15, 0, 8, 150, 3],
        [20, 0, 5, 75, 1],
      ],
      secondary: [1, 42, 1_000, 22],
      prime: [6, 125, 3],
    }),
    tour: createScale({
      placements: [
        [1, 3, 100, 7_500, 90],
        [2, 2, 70, 4_500, 62],
        [3, 1, 50, 2_750, 44],
        [5, 0, 34, 1_250, 28],
        [10, 0, 20, 500, 12],
        [15, 0, 12, 250, 6],
        [20, 0, 8, 125, 3],
        [30, 0, 5, 50, 1],
      ],
      secondary: [2, 50, 1_500, 30],
      prime: [6, 125, 3],
    }),
    grand_tour: createScale({
      placements: [
        [1, 3, 100, 7_500, 90],
        [2, 2, 70, 4_500, 62],
        [3, 1, 50, 2_750, 44],
        [5, 0, 34, 1_250, 28],
        [10, 0, 20, 500, 12],
        [15, 0, 12, 250, 6],
        [20, 0, 8, 125, 3],
        [30, 0, 5, 50, 1],
      ],
      secondary: [2, 50, 1_500, 30],
      prime: [6, 125, 3],
    }),
  },
  continental: {
    one_day: createScale({
      placements: [
        [1, 2, 78, 5_000, 70],
        [2, 1, 52, 3_000, 47],
        [3, 0, 38, 1_800, 34],
        [5, 0, 24, 800, 21],
        [10, 0, 14, 350, 9],
        [15, 0, 9, 175, 4],
        [20, 0, 6, 100, 2],
      ],
      secondary: [2, 54, 1_500, 30],
      prime: [7, 150, 4],
    }),
    tour: createScale({
      placements: [
        [1, 3, 120, 11_000, 135],
        [2, 2, 84, 7_000, 90],
        [3, 1, 60, 4_250, 62],
        [5, 0, 38, 1_800, 36],
        [10, 0, 22, 700, 15],
        [15, 0, 14, 350, 8],
        [20, 0, 9, 175, 4],
        [30, 0, 5, 75, 1],
      ],
      secondary: [2, 66, 2_200, 42],
      prime: [7, 150, 4],
    }),
    grand_tour: createScale({
      placements: [
        [1, 3, 120, 11_000, 135],
        [2, 2, 84, 7_000, 90],
        [3, 1, 60, 4_250, 62],
        [5, 0, 38, 1_800, 36],
        [10, 0, 22, 700, 15],
        [15, 0, 14, 350, 8],
        [20, 0, 9, 175, 4],
        [30, 0, 5, 75, 1],
      ],
      secondary: [2, 66, 2_200, 42],
      prime: [7, 150, 4],
    }),
  },
  world: {
    one_day: createScale({
      placements: [
        [1, 3, 125, 15_000, 170],
        [2, 1, 84, 9_000, 115],
        [3, 0, 60, 5_500, 80],
        [5, 0, 38, 2_500, 48],
        [10, 0, 22, 1_000, 20],
        [15, 0, 14, 500, 10],
        [20, 0, 9, 250, 5],
        [30, 0, 5, 100, 2],
      ],
      secondary: [3, 84, 3_750, 60],
      prime: [10, 300, 6],
    }),
    tour: createScale({
      placements: [
        [1, 5, 210, 30_000, 340],
        [2, 3, 145, 18_000, 235],
        [5, 2, 96, 8_500, 135],
        [10, 1, 50, 3_500, 52],
        [20, 0, 25, 1_000, 20],
        [30, 0, 12, 500, 8],
        [40, 0, 6, 200, 2],
      ],
      secondary: [3, 102, 5_500, 84],
      prime: [10, 300, 6],
    }),
    grand_tour: createScale({
      placements: [
        [1, 5, 210, 30_000, 340],
        [2, 3, 145, 18_000, 235],
        [5, 2, 96, 8_500, 135],
        [10, 1, 50, 3_500, 52],
        [20, 0, 25, 1_000, 20],
        [30, 0, 12, 500, 8],
        [40, 0, 6, 200, 2],
      ],
      secondary: [3, 102, 5_500, 84],
      prime: [10, 300, 6],
    }),
  },
  elite: {
    one_day: createScale({
      placements: [
        [1, 10, 340, 35_000, 550],
        [2, 3, 195, 21_000, 385],
        [3, 1, 130, 13_000, 275],
        [5, 0, 84, 5_000, 175],
        [10, 0, 44, 2_000, 78],
        [20, 0, 22, 750, 30],
        [30, 0, 11, 300, 12],
        [40, 0, 5, 100, 3],
      ],
      secondary: [3, 120, 7_500, 115],
      prime: [15, 600, 10],
    }),
    tour: createScale({
      placements: [
        [1, 12, 410, 70_000, 780],
        [2, 6, 275, 42_000, 560],
        [3, 3, 195, 27_000, 400],
        [10, 2, 96, 7_000, 170],
        [20, 0, 45, 2_500, 65],
        [30, 0, 24, 1_000, 28],
        [40, 0, 12, 400, 10],
        [50, 0, 6, 150, 3],
      ],
      secondary: [3, 145, 11_000, 160],
      prime: [15, 600, 10],
    }),
    grand_tour: createScale({
      placements: [
        [1, 25, 850, 140_000, 1_300],
        [2, 20, 650, 90_000, 980],
        [5, 10, 400, 45_000, 650],
        [10, 5, 220, 18_000, 330],
        [20, 2, 100, 6_000, 135],
        [40, 0, 45, 2_000, 48],
        [60, 0, 18, 750, 15],
      ],
      secondary: [10, 350, 24_000, 330],
      prime: [18, 900, 15],
    }),
  },
};

export const DIVISION_RULES = [
  {
    code: "elite",
    name: "Élite",
    minimumRank: 1,
    maximumRank: 20,
    seasonReputationBonus: 15,
  },
  {
    code: "world",
    name: "World",
    minimumRank: 21,
    maximumRank: 50,
    seasonReputationBonus: 8,
  },
  {
    code: "continental",
    name: "Continentale",
    minimumRank: 51,
    maximumRank: 100,
    seasonReputationBonus: 4,
  },
  {
    code: "national",
    name: "Nationale",
    minimumRank: 101,
    maximumRank: 200,
    seasonReputationBonus: 1,
  },
] as const;

export const ELITE_RACE_BASE_WILDCARD_PLACES = 4;

export type TeamDivisionCode =
  (typeof DIVISION_RULES)[number]["code"] | "amateur";

export type FinanceLedgerEntry = {
  dayNumber: number;
  amount: number;
  status: "posted" | "pending" | "cancelled";
};

export type FinanceChartPoint = {
  dayNumber: number;
  actualBalance: number | null;
  projectedBalance: number;
};

export type WildcardCandidate = {
  teamId: string;
  rankingPosition: number;
  uciPoints: number;
  leaderProfileFit: number;
  teamCountryMatchesRace?: boolean;
  sponsorCountryMatchesRace?: boolean;
  reputationPoints?: number;
  requested: boolean;
  alreadyInvited?: boolean;
};

export function calculateRaceReward(input: RaceRewardInput): RaceReward {
  return calculateRaceRewardBreakdown(input).total;
}

export function calculateRaceRewardBreakdown(
  input: RaceRewardInput,
): RaceRewardBreakdown {
  const scales = usesExpandedRaceRewards(input.gameYear)
    ? SEASON_FOUR_REWARD_SCALES
    : LEGACY_REWARD_SCALES;
  const scale = scales[input.tier][input.scope];
  const placement = findPlacement(scale.placements, input.finalRank);
  const secondaryClassifications = [
    ...new Set(input.secondaryClassifications ?? []),
  ];
  const mountainPrimeCount = Math.max(
    0,
    Math.floor(input.mountainPrimesWon ?? 0),
  );
  const intermediateSprintCount = Math.max(
    0,
    Math.floor(input.intermediateSprintsWon ?? 0),
  );
  const components: RaceRewardComponent[] = [];

  if (placement) {
    components.push({ type: "general", count: 1, ...placement });
  }

  for (const classification of secondaryClassifications) {
    components.push({
      type: `${classification}_classification`,
      count: 1,
      reputation: scale.secondaryReputation,
      experience: scale.secondaryExperience,
      cashPrize: scale.secondaryCashPrize,
      uciPoints: scale.secondaryUciPoints,
    });
  }

  if (mountainPrimeCount > 0) {
    components.push({
      type: "mountain_prime",
      count: mountainPrimeCount,
      reputation: 0,
      experience: mountainPrimeCount * scale.primeExperience,
      cashPrize: mountainPrimeCount * scale.primeCashPrize,
      uciPoints: mountainPrimeCount * scale.primeUciPoints,
    });
  }

  if (intermediateSprintCount > 0) {
    components.push({
      type: "intermediate_sprint",
      count: intermediateSprintCount,
      reputation: 0,
      experience: intermediateSprintCount * scale.primeExperience,
      cashPrize: intermediateSprintCount * scale.primeCashPrize,
      uciPoints: intermediateSprintCount * scale.primeUciPoints,
    });
  }

  return {
    components,
    total: components.reduce<RaceReward>(
      (total, component) => ({
        reputation: total.reputation + component.reputation,
        experience: total.experience + component.experience,
        cashPrize: total.cashPrize + component.cashPrize,
        uciPoints: total.uciPoints + component.uciPoints,
      }),
      { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 },
    ),
  };
}

/**
 * Les championnats nationaux valorisent le prestige local sans alimenter le
 * classement UCI. Le barème est identique pour la route et le contre-la-montre.
 */
export function calculateNationalChampionshipReward({
  finalRank,
  gameYear,
}: NationalChampionshipRewardInput): RaceReward {
  if (finalRank === null || !Number.isFinite(finalRank) || finalRank < 1) {
    return { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
  }

  const placements = usesExpandedRaceRewards(gameYear)
    ? [
        { maxRank: 1, reputation: 1, experience: 150, cashPrize: 12_000 },
        { maxRank: 2, reputation: 0, experience: 100, cashPrize: 7_000 },
        { maxRank: 3, reputation: 0, experience: 70, cashPrize: 4_000 },
        { maxRank: 5, reputation: 0, experience: 45, cashPrize: 2_000 },
        { maxRank: 10, reputation: 0, experience: 25, cashPrize: 750 },
        { maxRank: 15, reputation: 0, experience: 12, cashPrize: 300 },
        { maxRank: 20, reputation: 0, experience: 6, cashPrize: 100 },
      ]
    : [
        { maxRank: 1, reputation: 1, experience: 125, cashPrize: 10_000 },
        { maxRank: 2, reputation: 0, experience: 75, cashPrize: 5_000 },
        { maxRank: 3, reputation: 0, experience: 45, cashPrize: 2_500 },
        { maxRank: 5, reputation: 0, experience: 25, cashPrize: 1_000 },
      ];
  const placement = placements.find((rule) => finalRank <= rule.maxRank);

  return placement
    ? {
        reputation: placement.reputation,
        experience: placement.experience,
        cashPrize: placement.cashPrize,
        uciPoints: 0,
      }
    : { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
}

/**
 * Les championnats continentaux et mondiaux ont un bareme de prestige dedie,
 * identique pour la course en ligne et le contre-la-montre.
 */
export function calculateInternationalChampionshipReward({
  competitionType,
  finalRank,
  gameYear,
}: InternationalChampionshipRewardInput): RaceReward {
  if (finalRank === null || !Number.isFinite(finalRank) || finalRank < 1) {
    return { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
  }

  const legacyScales: Record<
    InternationalChampionshipRewardInput["competitionType"],
    PlacementRule[]
  > = {
    continental_championship: [
      {
        maxRank: 1,
        reputation: 2,
        experience: 250,
        cashPrize: 20_000,
        uciPoints: 250,
      },
      {
        maxRank: 2,
        reputation: 1,
        experience: 150,
        cashPrize: 10_000,
        uciPoints: 150,
      },
      {
        maxRank: 3,
        reputation: 0,
        experience: 90,
        cashPrize: 5_000,
        uciPoints: 100,
      },
      {
        maxRank: 5,
        reputation: 0,
        experience: 50,
        cashPrize: 2_000,
        uciPoints: 60,
      },
      {
        maxRank: 10,
        reputation: 0,
        experience: 25,
        cashPrize: 0,
        uciPoints: 25,
      },
    ],
    world_championship: [
      {
        maxRank: 1,
        reputation: 5,
        experience: 625,
        cashPrize: 50_000,
        uciPoints: 600,
      },
      {
        maxRank: 2,
        reputation: 3,
        experience: 375,
        cashPrize: 25_000,
        uciPoints: 475,
      },
      {
        maxRank: 3,
        reputation: 2,
        experience: 225,
        cashPrize: 12_500,
        uciPoints: 400,
      },
      {
        maxRank: 5,
        reputation: 1,
        experience: 125,
        cashPrize: 5_000,
        uciPoints: 325,
      },
      {
        maxRank: 10,
        reputation: 0,
        experience: 60,
        cashPrize: 2_000,
        uciPoints: 200,
      },
    ],
  };
  const seasonFourScales: typeof legacyScales = {
    continental_championship: [
      {
        maxRank: 1,
        reputation: 2,
        experience: 300,
        cashPrize: 24_000,
        uciPoints: 280,
      },
      {
        maxRank: 2,
        reputation: 1,
        experience: 190,
        cashPrize: 13_000,
        uciPoints: 175,
      },
      {
        maxRank: 3,
        reputation: 0,
        experience: 120,
        cashPrize: 7_000,
        uciPoints: 120,
      },
      {
        maxRank: 5,
        reputation: 0,
        experience: 70,
        cashPrize: 3_000,
        uciPoints: 75,
      },
      {
        maxRank: 10,
        reputation: 0,
        experience: 40,
        cashPrize: 1_000,
        uciPoints: 35,
      },
      {
        maxRank: 15,
        reputation: 0,
        experience: 20,
        cashPrize: 400,
        uciPoints: 15,
      },
      {
        maxRank: 20,
        reputation: 0,
        experience: 10,
        cashPrize: 150,
        uciPoints: 5,
      },
    ],
    world_championship: [
      {
        maxRank: 1,
        reputation: 5,
        experience: 700,
        cashPrize: 60_000,
        uciPoints: 650,
      },
      {
        maxRank: 2,
        reputation: 3,
        experience: 450,
        cashPrize: 32_000,
        uciPoints: 520,
      },
      {
        maxRank: 3,
        reputation: 2,
        experience: 300,
        cashPrize: 18_000,
        uciPoints: 440,
      },
      {
        maxRank: 5,
        reputation: 1,
        experience: 175,
        cashPrize: 8_000,
        uciPoints: 350,
      },
      {
        maxRank: 10,
        reputation: 0,
        experience: 90,
        cashPrize: 3_500,
        uciPoints: 225,
      },
      {
        maxRank: 15,
        reputation: 0,
        experience: 45,
        cashPrize: 1_500,
        uciPoints: 100,
      },
      {
        maxRank: 20,
        reputation: 0,
        experience: 20,
        cashPrize: 500,
        uciPoints: 40,
      },
    ],
  };
  const scales = usesExpandedRaceRewards(gameYear)
    ? seasonFourScales
    : legacyScales;
  const placement = scales[competitionType].find(
    (rule) => finalRank <= rule.maxRank,
  );

  return placement
    ? {
        reputation: placement.reputation,
        experience: placement.experience,
        cashPrize: placement.cashPrize,
        uciPoints: placement.uciPoints,
      }
    : { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
}

/**
 * Récompense d'étape, inférieure au général mais comptée au classement UCI.
 */
export function calculateStageReward({
  tier,
  finalRank,
  gameYear,
}: StagePrizeInput): RaceReward {
  if (finalRank === null || !Number.isFinite(finalRank) || finalRank < 1) {
    return { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
  }

  const scales = usesExpandedRaceRewards(gameYear)
    ? SEASON_FOUR_STAGE_PRIZE_SCALES
    : LEGACY_STAGE_PRIZE_SCALES;
  const placement = scales[tier].find(
    (placement) => finalRank <= placement.maxRank,
  );

  return placement
    ? {
        reputation: 0,
        experience: placement.experience ?? 0,
        cashPrize: placement.cashPrize,
        uciPoints: placement.uciPoints,
      }
    : { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
}

export function calculateStagePrize(input: StagePrizeInput): number {
  return calculateStageReward(input).cashPrize;
}

export function calculateRiderSeasonSalary({
  overall,
  previousSeasonPerformancePercentile = null,
  isAmateur = false,
}: {
  overall: number;
  previousSeasonPerformancePercentile?: number | null;
  isAmateur?: boolean;
}): number {
  if (isAmateur) {
    return 0;
  }

  const baseSalary = interpolateRiderSalaryBase(overall);
  const performanceMultiplier = getRiderSalaryPerformanceMultiplier(
    previousSeasonPerformancePercentile,
  );

  return (
    Math.round(
      clamp(baseSalary * performanceMultiplier, 6_000, 400_000) / 500,
    ) * 500
  );
}

export function getRiderSalaryPerformanceMultiplier(
  percentile: number | null | undefined,
): number {
  if (percentile === null || percentile === undefined) return 0.9;

  const safePercentile = clamp(percentile, 0, 1);
  if (safePercentile >= 0.99) return 1.7;
  if (safePercentile >= 0.95) return 1.5;
  if (safePercentile >= 0.85) return 1.35;
  if (safePercentile >= 0.7) return 1.2;
  if (safePercentile >= 0.5) return 1.1;
  if (safePercentile >= 0.2) return 1;
  return 0.9;
}

const RIDER_SALARY_BASE_KNOTS = [
  { overall: 0, salary: 6_000 },
  { overall: 45, salary: 6_000 },
  { overall: 50, salary: 7_000 },
  { overall: 55, salary: 10_000 },
  { overall: 59, salary: 14_000 },
  { overall: 60, salary: 16_000 },
  { overall: 65, salary: 25_000 },
  { overall: 70, salary: 40_000 },
  { overall: 75, salary: 65_000 },
  { overall: 80, salary: 105_000 },
  { overall: 85, salary: 175_000 },
  { overall: 90, salary: 240_000 },
  { overall: 100, salary: 260_000 },
] as const;

function interpolateRiderSalaryBase(overall: number): number {
  const safeOverall = clamp(overall, 0, 100);
  const upperIndex = RIDER_SALARY_BASE_KNOTS.findIndex(
    (knot) => knot.overall >= safeOverall,
  );
  if (upperIndex <= 0) return RIDER_SALARY_BASE_KNOTS[0].salary;

  const lower = RIDER_SALARY_BASE_KNOTS[upperIndex - 1]!;
  const upper = RIDER_SALARY_BASE_KNOTS[upperIndex]!;
  const progress =
    (safeOverall - lower.overall) / (upper.overall - lower.overall);

  return lower.salary + (upper.salary - lower.salary) * progress;
}

export function getDivisionForRank(rank: number): TeamDivisionCode {
  const safeRank = Math.max(1, Math.floor(rank));
  return (
    DIVISION_RULES.find(
      (division) =>
        safeRank >= division.minimumRank && safeRank <= division.maximumRank,
    )?.code ?? "amateur"
  );
}

export function calculateDebtReputationPenalty(balance: number): number {
  if (balance >= 0) {
    return 0;
  }

  return Math.min(35, 10 + Math.ceil(Math.abs(balance) / 25_000) * 2);
}

export function buildFinanceProjection({
  currentDayNumber,
  openingBalance = 0,
  entries,
  seasonLength = 28,
}: {
  currentDayNumber: number;
  openingBalance?: number;
  entries: FinanceLedgerEntry[];
  seasonLength?: number;
}): FinanceChartPoint[] {
  const safeCurrentDay = clamp(Math.floor(currentDayNumber), 1, seasonLength);
  let projectedBalance = openingBalance;
  let actualBalance = openingBalance;

  return Array.from({ length: seasonLength }, (_, index) => {
    const dayNumber = index + 1;
    const dayEntries = entries.filter((entry) => entry.dayNumber === dayNumber);

    for (const entry of dayEntries) {
      if (entry.status !== "cancelled") {
        projectedBalance += entry.amount;
      }

      if (entry.status === "posted" && dayNumber <= safeCurrentDay) {
        actualBalance += entry.amount;
      }
    }

    return {
      dayNumber,
      actualBalance: dayNumber <= safeCurrentDay ? actualBalance : null,
      projectedBalance,
    };
  });
}

export function selectWildcardTeams(
  candidates: WildcardCandidate[],
  availablePlaces = ELITE_RACE_BASE_WILDCARD_PLACES,
): WildcardCandidate[] {
  const places = Math.max(0, Math.floor(availablePlaces));

  return candidates
    .filter((candidate) => {
      const division = getDivisionForRank(candidate.rankingPosition);

      return (
        candidate.requested && !candidate.alreadyInvited && division !== "elite"
      );
    })
    .sort(
      (left, right) =>
        calculateWildcardSelectionScore(right) -
          calculateWildcardSelectionScore(left) ||
        right.leaderProfileFit - left.leaderProfileFit ||
        right.uciPoints - left.uciPoints ||
        left.rankingPosition - right.rankingPosition ||
        left.teamId.localeCompare(right.teamId),
    )
    .slice(0, places);
}

export function calculateWildcardSelectionScore(
  candidate: WildcardCandidate,
): number {
  const reputation = Math.min(
    1_000,
    Math.max(0, candidate.reputationPoints ?? 0),
  );

  return (
    (candidate.teamCountryMatchesRace ? 250 : 0) +
    (candidate.sponsorCountryMatchesRace ? 150 : 0) +
    reputation * 0.25 +
    candidate.leaderProfileFit * 5
  );
}

function createScale({
  placements,
  secondary,
  prime,
}: {
  placements: Array<[number, number, number, number, number]>;
  secondary: [number, number, number, number];
  prime: [number, number, number];
}): RewardScale {
  return {
    placements: placements.map(
      ([maxRank, reputation, experience, cashPrize, uciPoints]) => ({
        maxRank,
        reputation,
        experience,
        cashPrize,
        uciPoints,
      }),
    ),
    secondaryReputation: secondary[0],
    secondaryExperience: secondary[1],
    secondaryCashPrize: secondary[2],
    secondaryUciPoints: secondary[3],
    primeExperience: prime[0],
    primeCashPrize: prime[1],
    primeUciPoints: prime[2],
  };
}

function findPlacement(
  placements: PlacementRule[],
  finalRank: number | null,
): PlacementRule | null {
  if (finalRank === null || !Number.isFinite(finalRank) || finalRank < 1) {
    return null;
  }

  return placements.find((placement) => finalRank <= placement.maxRank) ?? null;
}

function usesExpandedRaceRewards(gameYear: number | undefined): boolean {
  return (
    gameYear !== undefined &&
    Number.isFinite(gameYear) &&
    gameYear >= EXPANDED_RACE_REWARDS_START_GAME_YEAR
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
