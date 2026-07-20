export type RaceTier = "national" | "continental" | "world" | "elite";

export type RaceRewardScope = "one_day" | "tour" | "grand_tour";

export type SecondaryClassification =
  | "mountain"
  | "sprint"
  | "youth"
  | "team";

export type RaceRewardInput = {
  tier: RaceTier;
  scope: RaceRewardScope;
  finalRank: number | null;
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

const REWARD_SCALES: Record<RaceTier, Record<RaceRewardScope, RewardScale>> = {
  national: {
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

export const DIVISION_RULES = [
  {
    code: "elite",
    name: "Élite",
    minimumRank: 1,
    maximumRank: 20,
    seasonReputationBonus: 15,
    guaranteedWildcards: 4,
  },
  {
    code: "world",
    name: "World",
    minimumRank: 21,
    maximumRank: 50,
    seasonReputationBonus: 8,
    guaranteedWildcards: 0,
  },
  {
    code: "continental",
    name: "Continentale",
    minimumRank: 51,
    maximumRank: 100,
    seasonReputationBonus: 4,
    guaranteedWildcards: 0,
  },
  {
    code: "national",
    name: "Nationale",
    minimumRank: 101,
    maximumRank: 200,
    seasonReputationBonus: 1,
    guaranteedWildcards: 0,
  },
] as const;

export type TeamDivisionCode = (typeof DIVISION_RULES)[number]["code"] | "amateur";

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
  requested: boolean;
  alreadyInvited?: boolean;
};

export function calculateRaceReward(input: RaceRewardInput): RaceReward {
  const scale = REWARD_SCALES[input.tier][input.scope];
  const placement = findPlacement(scale.placements, input.finalRank);
  const secondaryCount = new Set(input.secondaryClassifications ?? []).size;
  const primeCount = Math.max(0, Math.floor(input.mountainPrimesWon ?? 0))
    + Math.max(0, Math.floor(input.intermediateSprintsWon ?? 0));

  return {
    reputation:
      (placement?.reputation ?? 0)
      + secondaryCount * scale.secondaryReputation,
    experience:
      (placement?.experience ?? 0)
      + secondaryCount * scale.secondaryExperience
      + primeCount * scale.primeExperience,
    cashPrize:
      (placement?.cashPrize ?? 0)
      + secondaryCount * scale.secondaryCashPrize
      + primeCount * scale.primeCashPrize,
    uciPoints:
      (placement?.uciPoints ?? 0)
      + secondaryCount * scale.secondaryUciPoints
      + primeCount * scale.primeUciPoints,
  };
}

export function calculateRiderSeasonSalary({
  overall,
  previousSeasonUciPoints = 0,
  majorWins = 0,
  isAmateur = false,
}: {
  overall: number;
  previousSeasonUciPoints?: number;
  majorWins?: number;
  isAmateur?: boolean;
}): number {
  if (isAmateur) {
    return 0;
  }

  const safeOverall = clamp(overall, 0, 100);
  const talentFactor = Math.max(0, (safeOverall - 45) / 55);
  const talentSalary = 2_500 + talentFactor ** 2 * 100_000;
  const pedigreeBonus = Math.min(37_500, Math.max(0, previousSeasonUciPoints) * 30)
    + Math.min(20_000, Math.max(0, majorWins) * 5_000);

  return Math.round(clamp(talentSalary + pedigreeBonus, 2_500, 150_000) / 100) * 100;
}

export function getDivisionForRank(rank: number): TeamDivisionCode {
  const safeRank = Math.max(1, Math.floor(rank));
  return DIVISION_RULES.find(
    (division) => safeRank >= division.minimumRank && safeRank <= division.maximumRank
  )?.code ?? "amateur";
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
  availablePlaces: number
): WildcardCandidate[] {
  const places = Math.max(0, Math.floor(availablePlaces));

  return candidates
    .filter(
      (candidate) =>
        candidate.requested
        && !candidate.alreadyInvited
        && getDivisionForRank(candidate.rankingPosition) !== "elite"
    )
    .sort(
      (left, right) =>
        right.leaderProfileFit - left.leaderProfileFit
        || right.uciPoints - left.uciPoints
        || left.rankingPosition - right.rankingPosition
        || left.teamId.localeCompare(right.teamId)
    )
    .slice(0, places);
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
      })
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
  finalRank: number | null
): PlacementRule | null {
  if (finalRank === null || !Number.isFinite(finalRank) || finalRank < 1) {
    return null;
  }

  return placements.find((placement) => finalRank <= placement.maxRank) ?? null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
