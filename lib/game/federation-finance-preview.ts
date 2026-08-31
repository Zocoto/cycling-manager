export const FEDERATION_OBJECTIVE_LEVELS = [
  "none",
  "bronze",
  "silver",
  "gold",
] as const;

export type FederationObjectiveLevel =
  (typeof FEDERATION_OBJECTIVE_LEVELS)[number];

export type FederationFinancePreviewInput = {
  nationRank: number;
  division: 1 | 2 | 3 | 4;
  raceDays: number;
  averageStarters: number;
  donations: number;
  objectiveLevel: FederationObjectiveLevel;
};

export type FederationFinancePreview = {
  commonGrant: number;
  uciGrant: number;
  nationsCupGrant: number;
  raceRevenue: number;
  objectiveBonus: number;
  donations: number;
  totalRevenue: number;
  reserveEnvelope: number;
  infrastructureEnvelope: number;
  solidarityEnvelope: number;
  courseFillRate: number;
};

const ACTIVE_NATION_COUNT = 173;
const COMMON_GRANT = 1_200_000;
const NATIONS_CUP_GRANTS: Record<1 | 2 | 3 | 4, number> = {
  1: 450_000,
  2: 300_000,
  3: 200_000,
  4: 120_000,
};
const OBJECTIVE_BONUS_RATES: Record<FederationObjectiveLevel, number> = {
  none: 0,
  bronze: 0.03,
  silver: 0.06,
  gold: 0.1,
};

export function calculateFederationFinancePreview(
  rawInput: FederationFinancePreviewInput,
): FederationFinancePreview {
  const nationRank = clampInteger(rawInput.nationRank, 1, ACTIVE_NATION_COUNT);
  const division = clampInteger(rawInput.division, 1, 4) as 1 | 2 | 3 | 4;
  const raceDays = clampInteger(rawInput.raceDays, 0, 40);
  const averageStarters = clampInteger(rawInput.averageStarters, 0, 200);
  const donations = roundTo(rawInput.donations, 5_000, 0, 5_000_000);
  const objectiveLevel = FEDERATION_OBJECTIVE_LEVELS.includes(
    rawInput.objectiveLevel,
  )
    ? rawInput.objectiveLevel
    : "none";

  const uciPerformance =
    1 - (nationRank - 1) / Math.max(1, ACTIVE_NATION_COUNT - 1);
  const uciGrant = roundToNearest(
    150_000 + 850_000 * Math.sqrt(uciPerformance),
    5_000,
  );
  const nationsCupGrant = NATIONS_CUP_GRANTS[division];
  const courseFillRate = Math.min(1, averageStarters / 160);
  const raceRevenue = roundToNearest(
    raceDays * (5_000 + 12_000 * courseFillRate),
    1_000,
  );
  const structuralRevenue = COMMON_GRANT + uciGrant + nationsCupGrant;
  const objectiveBonus = roundToNearest(
    structuralRevenue * OBJECTIVE_BONUS_RATES[objectiveLevel],
    5_000,
  );
  const totalRevenue =
    structuralRevenue + raceRevenue + objectiveBonus + donations;

  return {
    commonGrant: COMMON_GRANT,
    uciGrant,
    nationsCupGrant,
    raceRevenue,
    objectiveBonus,
    donations,
    totalRevenue,
    reserveEnvelope: roundToNearest(totalRevenue * 0.35, 5_000),
    infrastructureEnvelope: roundToNearest(totalRevenue * 0.4, 5_000),
    solidarityEnvelope: roundToNearest(totalRevenue * 0.25, 5_000),
    courseFillRate,
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function roundTo(
  value: number,
  step: number,
  minimum: number,
  maximum: number,
): number {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return roundToNearest(Math.min(maximum, Math.max(minimum, finiteValue)), step);
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}
