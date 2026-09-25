import { type RaceCategoryCode, type RaceFormat } from "./race-calendar";

export const RACE_RECONNAISSANCE_DURATION_DAYS = 2;
export const RACE_RECONNAISSANCE_BASE_BONUS = 2;

const RECONNAISSANCE_COSTS: Record<
  RaceCategoryCode,
  Record<RaceFormat, number>
> = {
  elite: {
    one_day: 20_000,
    stage_race: 15_000,
  },
  world: {
    one_day: 12_000,
    stage_race: 9_000,
  },
  continental: {
    one_day: 7_000,
    stage_race: 5_000,
  },
  national: {
    one_day: 4_000,
    stage_race: 3_000,
  },
  regional: {
    one_day: 2_500,
    stage_race: 2_000,
  },
};

export function getRaceReconnaissanceCost({
  categoryCode,
  raceFormat,
}: {
  categoryCode: RaceCategoryCode;
  raceFormat: RaceFormat;
}) {
  return RECONNAISSANCE_COSTS[categoryCode][raceFormat];
}

export function getRacePreparerBonusPercentage(level: number) {
  const safeLevel = Math.min(
    5,
    Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)),
  );

  return safeLevel * 5;
}

export function getRacePreparerReconnaissanceCostReductionPercentage(
  level: number,
  hasNegotiatedLogistics: boolean,
) {
  if (!hasNegotiatedLogistics) return 0;

  const safeLevel = Math.min(
    5,
    Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)),
  );
  return safeLevel * 4;
}

export function getAdjustedRaceReconnaissanceCost({
  baseCost,
  reductionPercentage,
}: {
  baseCost: number;
  reductionPercentage: number;
}) {
  const safeBaseCost = Math.max(0, Number.isFinite(baseCost) ? baseCost : 0);
  const safeReduction = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(reductionPercentage) ? reductionPercentage : 0,
    ),
  );

  return Math.round(safeBaseCost * (1 - safeReduction / 100) * 100) / 100;
}

export function getRaceReconnaissanceBonus(level?: number | null) {
  const preparerBonusPercentage = getRacePreparerBonusPercentage(level ?? 0);

  return (
    Math.round(
      RACE_RECONNAISSANCE_BASE_BONUS *
        (1 + preparerBonusPercentage / 100) *
        100,
    ) / 100
  );
}

export function getRaceReconnaissanceErrorMessage(error: {
  code?: string | null;
  message: string;
}) {
  const isInternalConstraintError =
    error.code === "23514" ||
    /violates check constraint|new row for relation/i.test(error.message);

  return isInternalConstraintError
    ? "La reconnaissance n’a pas pu être enregistrée à cause d’un réglage technique. Réessayez dans quelques instants."
    : error.message;
}
