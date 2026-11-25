import { describe, expect, it } from "vitest";
import type { RaceStageSegment } from "./race-profiles";
import { getTimeTrialClimbRating, withTimeTrialClimbWeights } from "./time-trial-climb-rating";

function segment(
  segmentNumber: number,
  terrain: RaceStageSegment["terrain"],
  distanceKm: number,
  averageGradientPct: number,
): RaceStageSegment {
  return { segmentNumber, terrain, distanceKm, averageGradientPct, surface: "asphalt", prime: null };
}

describe("time-trial climbing notes", () => {
  it.each([8, 9, 12, 18])("uses 42%% CLM and 38%% MO without VAL on an isolated %i%% ITT ascent", (grade) => {
    const [rated] = withTimeTrialClimbWeights([segment(1, "climb", 12, grade)], "individual_time_trial");
    expect(rated.timeTrialClimbWeights?.timeTrial).toBeCloseTo(0.42);
    expect(rated.timeTrialClimbWeights?.mountain).toBeCloseTo(0.38);
    expect(rated.timeTrialClimbWeights).toMatchObject({
      hills: 0, flat: 0, endurance: 0.1, resistance: 0.05, form: 0.05,
    });
  });

  it.each([
    [2, 0.58, 0.15], [4, 0.54, 0.26], [6, 0.48, 0.32],
  ])("uses progressively higher mountain influence at %i%%", (grade, timeTrial, mountain) => {
    const weights = withTimeTrialClimbWeights([segment(1, "climb", 12, grade)], "individual_time_trial")[0].timeTrialClimbWeights!;
    expect(weights.timeTrial).toBeCloseTo(timeTrial);
    expect(weights.mountain).toBeCloseTo(mountain);
    expect(weights.hills).toBe(0);
  });

  it.each([
    [1, 0.35], [2, 0.35], [3.5, 0.365], [5, 0.38], [8, 0.38],
  ])("scales the steep-climb bonus with the length of the whole %g km ascent", (distance, mountain) => {
    const course = [segment(1, "climb", distance / 2, 8), segment(2, "climb", distance / 2, 8)];
    const rated = withTimeTrialClimbWeights(course, "individual_time_trial");
    for (const part of rated) {
      expect(part.timeTrialClimbWeights?.mountain).toBeCloseTo(mountain);
      expect(part.timeTrialClimbWeights?.timeTrial).toBeCloseTo(0.8 - mountain);
    }
  });

  it.each(["prologue", "team_time_trial"] as const)("keeps the original climbing weights in %s", (stageType) => {
    const [rated] = withTimeTrialClimbWeights([segment(1, "climb", 12, 8)], stageType);
    expect(rated.timeTrialClimbWeights).toEqual({
      timeTrial: 0.45, mountain: 0.35, hills: 0, flat: 0, endurance: 0.1, resistance: 0.05, form: 0.05,
    });
  });

  it("keeps normalized continuous weights between gradient anchors", () => {
    let previousMountain = 0;
    for (let grade = 0; grade <= 12; grade += 0.125) {
      const weights = withTimeTrialClimbWeights([segment(1, "climb", 12, grade)], "individual_time_trial")[0].timeTrialClimbWeights!;
      expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
      expect(Object.values(weights).every((weight) => weight >= 0)).toBe(true);
      expect(weights.mountain).toBeGreaterThanOrEqual(previousMountain);
      previousMountain = weights.mountain;
    }
  });

  it("treats one segmented ascent as one col and counts repeated descending passes", () => {
    const uphill = [segment(1, "climb", 6, 8), segment(2, "climb", 6, 8)];
    expect(withTimeTrialClimbWeights(uphill, "individual_time_trial").every((part) => part.timeTrialClimbWeights?.hills === 0)).toBe(true);

    const course = [uphill[0], segment(2, "descent", 4, -5), segment(3, "climb", 6, 8)];
    const rated = withTimeTrialClimbWeights(course, "individual_time_trial");
    expect(rated[0].timeTrialClimbWeights?.timeTrial).toBeCloseTo(0.42);
    expect(rated[0].timeTrialClimbWeights?.mountain).toBeCloseTo(0.33);
    expect(rated[0].timeTrialClimbWeights?.hills).toBeCloseTo(0.05);
    expect(rated[1].timeTrialClimbWeights).toBeUndefined();
    expect(rated[2].timeTrialClimbWeights).toEqual(rated[0].timeTrialClimbWeights);
  });

  it("does not turn a flat ledge or insignificant downhill into an extra col", () => {
    for (const middle of [segment(2, "flat", 0.3, 0), segment(2, "descent", 0.1, -2)]) {
      const course = [segment(1, "climb", 6, 8), middle, segment(3, "climb", 6, 8)];
      expect(withTimeTrialClimbWeights(course, "individual_time_trial").filter((part) => part.timeTrialClimbWeights)
        .every((part) => part.timeTrialClimbWeights?.hills === 0)).toBe(true);
    }
  });

  it("increases MO even on a long shallow ascent and preserves the full-col context", () => {
    const continuous = withTimeTrialClimbWeights([segment(1, "climb", 35, 2)], "individual_time_trial")[0].timeTrialClimbWeights!;
    const split = withTimeTrialClimbWeights(Array.from({ length: 7 }, (_, index) => segment(index + 1, "climb", 5, 2)), "individual_time_trial");
    expect(continuous.mountain).toBeGreaterThan(0.82 * 0.27);
    expect(continuous.mountain).toBeLessThan(0.35);
    expect(Object.values(continuous).reduce((total, weight) => total + weight, 0)).toBeCloseTo(1);
    expect(split.every((part) => JSON.stringify(part.timeTrialClimbWeights) === JSON.stringify(continuous))).toBe(true);
  });

  it("recomputes course context without mutating inputs or retaining removed cols", () => {
    const source = [segment(1, "climb", 6, 8), segment(2, "descent", 4, -5), segment(3, "climb", 6, 8)];
    const before = structuredClone(source);
    const rated = withTimeTrialClimbWeights(source, "individual_time_trial");
    expect(source).toEqual(before);
    expect(withTimeTrialClimbWeights([rated[0]], "individual_time_trial")[0].timeTrialClimbWeights?.hills).toBe(0);
    expect(rated[0].timeTrialClimbWeights?.hills).toBe(0.05);
  });

  it("allocates the remaining 20%% to endurance, resistance and form", () => {
    const weights = withTimeTrialClimbWeights([segment(1, "climb", 12, 8)], "individual_time_trial")[0].timeTrialClimbWeights!;
    const ratings = { timeTrial: 80, mountain: 90, hills: 100, flat: 100, endurance: 70, resistance: 60 };
    expect(getTimeTrialClimbRating(ratings, weights)).toBeCloseTo(80 * 0.42 + 90 * 0.38 + 70 * 0.1 + 60 * 0.05);
  });
});
