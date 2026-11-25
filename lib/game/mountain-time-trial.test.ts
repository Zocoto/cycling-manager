import { describe, expect, it } from "vitest";

import { getStageFavoriteScore } from "./race-favorites";
import type { RaceStageSegment } from "./race-profiles";
import {
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type RiderSimulationRatings,
  type StageSimulationInput,
} from "./race-simulation";

function rider(
  id = "challenger",
  ratings: Partial<RiderSimulationRatings> = {},
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: id,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#ffffff",
    age: 27,
    form: 95,
    morale: 50,
    role: "leader",
    physiology: {
      heightCm: 175,
      weightKg: 65,
      baselineWeightKg: 65,
      physiologyVersion: 0,
      naturalProfile: "climber",
    },
    ratings: {
      flat: 70,
      mountain: 70,
      hills: 70,
      cobbles: 70,
      downhill: 70,
      sprint: 70,
      acceleration: 70,
      timeTrial: 70,
      prologue: 70,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 70,
      ...ratings,
    },
  };
}

function segment(
  segmentNumber: number,
  distanceKm: number,
  averageGradientPct: number,
): RaceStageSegment {
  return {
    segmentNumber,
    distanceKm,
    terrain: averageGradientPct > 0 ? "climb" : averageGradientPct < 0 ? "descent" : "flat",
    averageGradientPct,
    surface: "asphalt",
    prime: null,
  };
}

function stage(
  segments: RaceStageSegment[],
  riders = [rider()],
  stageType: StageSimulationInput["stageType"] = "individual_time_trial",
): StageSimulationInput {
  return {
    id: "mountain-time-trial-balance",
    name: "Chrono de montagne",
    stageType,
    profileType: "time_trial",
    isStageRace: false,
    seed: 17,
    weather: {
      condition: "clear",
      rainIntensity: "none",
      temperatureC: 20,
      windSpeedKph: 0,
      windDirection: "headwind",
      windIntensity: "calm",
      isWet: false,
    },
    segments,
    riders,
  };
}

function soloElapsed(segments: RaceStageSegment[], ratings: Partial<RiderSimulationRatings>) {
  return simulateRaceStage(stage(segments, [rider("challenger", ratings)])).results[0].elapsedTimeSeconds;
}

const summitFinish = [segment(1, 6, 8)];
const consecutivePasses = [segment(1, 3, 8), segment(2, 2, -6), segment(3, 3, 8)];

describe("mountain time-trial rating behavior", () => {
  it.each(["individual_time_trial", "prologue"] as const)(
    "does not use hills on a single sustained ascent in %s",
    (stageType) => {
      const route = [segment(1, 2, 8), segment(2, 2, 8), segment(3, 2, 8)];
      const lowHills = simulateRaceStage(stage(route, [rider("same", { hills: 30 })], stageType));
      const highHills = simulateRaceStage(stage(route, [rider("same", { hills: 95 })], stageType));
      expect(highHills.results).toEqual(lowHills.results);
      expect(highHills.timeline).toEqual(lowHills.timeline);
    },
  );

  it("makes the same improvement in chrono more valuable than mountain above eight percent", () => {
    const improvedChrono = soloElapsed(summitFinish, { timeTrial: 90 });
    const improvedMountain = soloElapsed(summitFinish, { mountain: 90 });
    const baseline = soloElapsed(summitFinish, {});
    expect(improvedChrono).toBeLessThan(improvedMountain);
    expect(improvedMountain).toBeLessThan(baseline);
  });

  it("lets a stronger climber challenge the chrono specialist on a sustained ascent while preserving the flat hierarchy", () => {
    const climber = { mountain: 93 };
    const specialist = { timeTrial: 90 };
    const uphill = [segment(1, 12, 8)];
    const flat = [segment(1, 12, 0)];

    expect(soloElapsed(uphill, climber)).toBeLessThan(soloElapsed(uphill, specialist));
    expect(soloElapsed(flat, specialist)).toBeLessThan(soloElapsed(flat, climber));
    expect(soloElapsed(flat, climber)).toBe(soloElapsed(flat, {}));
  });

  it("increases the mountain contribution continuously with the ascent gradient", () => {
    const relativeGains = [2, 4, 6, 8].map((gradient) => {
      const route = [segment(1, 6, gradient)];
      const baseline = soloElapsed(route, {});
      return 1 - soloElapsed(route, { mountain: 90 }) / baseline;
    });
    expect(relativeGains[0]).toBeGreaterThan(0);
    for (let index = 1; index < relativeGains.length; index += 1) {
      expect(relativeGains[index]).toBeGreaterThan(relativeGains[index - 1]);
    }
  });

  it("rewards hills on a sequence of genuine passes", () => {
    expect(soloElapsed(consecutivePasses, { hills: 95 }))
      .toBeLessThan(soloElapsed(consecutivePasses, { hills: 30 }));
  });

  it("does not turn small breaks in one ascent into a sequence of passes", () => {
    const route = [segment(1, 3, 8), segment(2, 0.2, -2), segment(3, 3, 8)];
    expect(soloElapsed(route, { hills: 95 })).toBe(soloElapsed(route, { hills: 30 }));
  });

  it("keeps endurance and resistance effective in a mountainous chrono", () => {
    const baseline = soloElapsed(summitFinish, {});
    expect(soloElapsed(summitFinish, { endurance: 90 })).toBeLessThan(baseline);
    expect(soloElapsed(summitFinish, { resistance: 90 })).toBeLessThan(baseline);
  });

  it("uses the same isolated-climb and repeated-pass behavior in results-only championships", () => {
    const anchor = rider("anchor", { timeTrial: 99, mountain: 99, hills: 99, endurance: 99, resistance: 99 });
    const gap = (route: RaceStageSegment[], ratings: Partial<RiderSimulationRatings>) => {
      const result = simulateRaceStageResultsOnly(stage(route, [anchor, rider("challenger", ratings)]));
      expect(result.results[0].riderId).toBe("anchor");
      return result.results.find(({ riderId }) => riderId === "challenger")!.gapToWinnerSeconds;
    };
    expect(gap(summitFinish, { hills: 95 })).toBe(gap(summitFinish, { hills: 30 }));
    expect(gap(summitFinish, { timeTrial: 90 })).toBeLessThan(gap(summitFinish, { mountain: 90 }));
    expect(gap(consecutivePasses, { hills: 95 })).toBeLessThan(gap(consecutivePasses, { hills: 30 }));
  });

  it("keeps the public favorites consistent with the actual mountainous chrono", () => {
    const score = (route: RaceStageSegment[], ratings: Partial<RiderSimulationRatings>) =>
      getStageFavoriteScore(stage(route), rider("same", ratings));
    expect(score(summitFinish, { hills: 95 })).toBe(score(summitFinish, { hills: 30 }));
    expect(score(summitFinish, { timeTrial: 90 })).toBeGreaterThan(score(summitFinish, { mountain: 90 }));
    expect(score(consecutivePasses, { hills: 95 })).toBeGreaterThan(score(consecutivePasses, { hills: 30 }));
  });

  it("uses the prologue note and mountain in an uphill prologue forecast", () => {
    const course = stage(summitFinish, [], "prologue");
    const score = (ratings: Partial<RiderSimulationRatings>) => getStageFavoriteScore(course, rider("same", ratings));
    expect(score({ hills: 95 })).toBe(score({ hills: 30 }));
    expect(score({ mountain: 90 })).toBeGreaterThan(score({}));
    expect(score({ prologue: 90 })).toBeGreaterThan(score({ mountain: 90 }));
    expect(score({ timeTrial: 90 })).toBe(score({}));
  });

  it("applies the ascent balance to team relays while preserving a coherent group", () => {
    const teamTime = (route: RaceStageSegment[], hills: number) => {
      const riders = Array.from({ length: 4 }, (_, index) => ({
        ...rider(`relay-${index}`, { hills }),
        teamId: "same-team",
        role: index === 0 ? "leader" as const : "domestique" as const,
      }));
      const result = simulateRaceStage(stage(route, riders, "team_time_trial"));
      expect(result.results).toHaveLength(4);
      expect(new Set(result.results.map(({ elapsedTimeSeconds }) => elapsedTimeSeconds)).size).toBe(1);
      return result.results[0].elapsedTimeSeconds;
    };
    expect(teamTime(summitFinish, 95)).toBe(teamTime(summitFinish, 30));
    expect(teamTime(consecutivePasses, 95)).toBeLessThan(teamTime(consecutivePasses, 30));
  });
});
