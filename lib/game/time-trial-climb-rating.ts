import { getClimbBlocks, type RaceStageSegment } from "./race-profiles";
import type { RiderSimulationRatings, SimulationStageType } from "./race-simulation";

export type TimeTrialClimbWeights = {
  timeTrial: number;
  mountain: number;
  hills: number;
  flat: number;
  endurance: number;
  resistance: number;
  form: number;
};

export type TimeTrialClimbSegment = RaceStageSegment & {
  timeTrialClimbWeights?: TimeTrialClimbWeights;
};

const CLIMB_WEIGHT_ANCHORS = [
  { gradient: 0, timeTrial: 0.58, mountain: 0, flat: 0.27, resistance: 0 },
  { gradient: 2, timeTrial: 0.58, mountain: 0.15, flat: 0.07, resistance: 0.05 },
  { gradient: 4, timeTrial: 0.55, mountain: 0.25, flat: 0, resistance: 0.05 },
  { gradient: 8, timeTrial: 0.45, mountain: 0.35, flat: 0, resistance: 0.05 },
] as const;

/** Adjacent climb segments remain one pass, including flatter ramps. */
export function withTimeTrialClimbWeights(
  segments: readonly RaceStageSegment[],
  stageType: SimulationStageType,
): TimeTrialClimbSegment[] {
  const climbs = getClimbBlocks([...segments]);
  const passes = climbs.filter((climb) =>
    climb.distanceKm >= 2 && climb.distanceKm * climb.averageGradientPct * 10 >= 100,
  );
  const hasRepeatedPasses = passes.some((climb, index) => {
    const previous = passes[index - 1];
    if (!previous) return false;
    const descentMeters = segments.slice(previous.finishIndex + 1, climb.startIndex)
      .reduce((total, segment) => total + (
        segment.terrain === "descent"
          ? segment.distanceKm * Math.max(0, -segment.averageGradientPct) * 10
          : 0
      ), 0);
    return descentMeters >= 50;
  });
  const ratedSegments: TimeTrialClimbSegment[] = segments.map((segment) => {
    // Recompute context from the actual course, including reused inputs.
    const courseSegment: TimeTrialClimbSegment = { ...segment };
    delete courseSegment.timeTrialClimbWeights;
    return courseSegment;
  });

  for (const climb of climbs) {
    const partOfPassChain = hasRepeatedPasses && passes.includes(climb);
    for (let index = climb.startIndex; index <= climb.finishIndex; index += 1) {
      ratedSegments[index].timeTrialClimbWeights = getClimbWeights(
        Math.max(0, segments[index].averageGradientPct),
        climb.distanceKm,
        partOfPassChain,
        stageType,
      );
    }
  }
  return ratedSegments;
}

function getClimbWeights(
  gradient: number,
  climbLengthKm: number,
  repeatedPasses: boolean,
  stageType: SimulationStageType,
): TimeTrialClimbWeights {
  const upper = CLIMB_WEIGHT_ANCHORS.find((anchor) => anchor.gradient >= gradient)
    ?? CLIMB_WEIGHT_ANCHORS[3];
  const lower = CLIMB_WEIGHT_ANCHORS[Math.max(0, CLIMB_WEIGHT_ANCHORS.indexOf(upper) - 1)];
  const progress = upper.gradient === lower.gradient ? 0 : Math.min(
    1, (gradient - lower.gradient) / (upper.gradient - lower.gradient),
  );
  const interpolate = (key: "timeTrial" | "mountain" | "flat" | "resistance") =>
    lower[key] + (upper[key] - lower[key]) * progress;
  // A very long shallow ascent could already give MO more influence than a
  // short ramp. Preserve that advantage while using the complete ascent.
  const previousMountainWeight = Math.min(0.82,
    0.18 + Math.max(0, gradient - 3) * 0.07 + Math.max(0, climbLengthKm - 5) * 0.025,
  ) * 0.27;
  const mountain = Math.max(interpolate("mountain"), previousMountainWeight + 0.01);
  const extraMountain = mountain - interpolate("mountain");
  const flatReduction = Math.min(interpolate("flat"), extraMountain);
  const hills = repeatedPasses ? Math.min(0.05, mountain) : 0;
  // Transfer up to three points from CLM to MO on sustained individual climbs.
  // The full shift applies from 5 km and 8%, with a gradual onset on both axes.
  const gradientProgress = Math.min(1, Math.max(0, (gradient - 2) / 6));
  const lengthProgress = Math.min(1, Math.max(0, (climbLengthKm - 2) / 3));
  const mountainShift = stageType === "individual_time_trial"
    ? 0.03 * gradientProgress * lengthProgress
    : 0;
  return {
    timeTrial: interpolate("timeTrial") - (extraMountain - flatReduction) - mountainShift,
    mountain: mountain - hills + mountainShift,
    hills,
    flat: interpolate("flat") - flatReduction,
    endurance: 0.1,
    resistance: interpolate("resistance"),
    form: 0.05,
  };
}

/** Form is added by the simulator, while favorites use intrinsic notes. */
export function getTimeTrialClimbRating(
  ratings: Pick<RiderSimulationRatings, "timeTrial" | "mountain" | "hills" | "flat" | "endurance" | "resistance">,
  weights: TimeTrialClimbWeights,
) {
  return ratings.timeTrial * weights.timeTrial + ratings.mountain * weights.mountain +
    ratings.hills * weights.hills + ratings.flat * weights.flat +
    ratings.endurance * weights.endurance + ratings.resistance * weights.resistance;
}
