import type {
  RaceCalendarStage,
  RaceProfileType,
  RaceStageType,
} from "./race-calendar";
import type { RaceStageSegment } from "./race-profiles";

type StageFormCostInput = {
  profileType: RaceProfileType;
  stageType: RaceStageType;
  distanceKm: number;
  segments?: RaceStageSegment[];
  recovery: number;
};

export type StageFormCostRange = {
  minimum: number;
  maximum: number;
};

const PROFILE_BASE_COST: Record<RaceProfileType, number> = {
  flat: 3,
  sprint: 3,
  hilly: 5,
  mountain: 7,
  cobbles: 6,
  time_trial: 3.5,
  mixed: 4.5,
};

/**
 * Estime le coût de forme réellement appliqué après une étape.
 * La récupération module le coût de -10 % (REC 100) à +10 % (REC 0).
 */
export function calculateStageFormCost({
  profileType,
  stageType,
  distanceKm,
  segments = [],
  recovery,
}: StageFormCostInput) {
  const isTimeTrial =
    profileType === "time_trial" ||
    stageType === "individual_time_trial" ||
    stageType === "team_time_trial" ||
    stageType === "prologue";
  let baseCost = isTimeTrial
    ? getTimeTrialBaseCost(distanceKm)
    : PROFILE_BASE_COST[profileType];

  if (!isTimeTrial) {
    if (distanceKm < 80) baseCost -= 0.5;
    if (distanceKm >= 180) baseCost += 0.5;
    if (distanceKm >= 220) baseCost += 0.5;
  }

  const totalSegmentDistance = segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0,
  );
  if (totalSegmentDistance > 0) {
    const climbShare =
      segments
        .filter((segment) => segment.terrain === "climb")
        .reduce((total, segment) => total + segment.distanceKm, 0) /
      totalSegmentDistance;
    const cobbleShare =
      segments
        .filter((segment) => segment.surface === "cobbles")
        .reduce((total, segment) => total + segment.distanceKm, 0) /
      totalSegmentDistance;

    if (isTimeTrial) {
      if (climbShare >= 0.25) baseCost += 1.5;
      else if (climbShare >= 0.1) baseCost += 0.75;
    } else if (profileType !== "cobbles" && cobbleShare >= 0.25) {
      baseCost += 1;
    }
  }

  const normalizedRecovery = clamp(recovery, 0, 100);
  const recoveryMultiplier = 1.1 - normalizedRecovery * 0.002;

  return roundToTenth(Math.max(1, baseCost * recoveryMultiplier));
}

export function getStageFormCostRange(
  stage: Pick<
    RaceCalendarStage,
    "profileType" | "stageType" | "distanceKm" | "segments"
  >,
): StageFormCostRange {
  return {
    minimum: calculateStageFormCost({ ...stage, recovery: 100 }),
    maximum: calculateStageFormCost({ ...stage, recovery: 0 }),
  };
}

function getTimeTrialBaseCost(distanceKm: number) {
  if (distanceKm <= 12) return 2;
  if (distanceKm <= 25) return 3.5;
  if (distanceKm <= 45) return 5;
  return 6;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}
