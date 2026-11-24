import { describe, expect, it } from "vitest";
import { EMPTY_EQUIPMENT_EFFECTS } from "./equipment";
import { buildTeamTimeTrialFavorites, getRaceFavoriteScore, getStageFavoriteScore } from "./race-favorites";
import type { RaceCalendarStage } from "./race-calendar";
import { inferRiderPhysiologyProfile } from "./rider-physiology";
import { simulateRaceStage, simulateRaceStageResultsOnly, type RiderSimulationInput, type SimulationStageType, type StageSimulationInput } from "./race-simulation";

function rider(mountain = 70): RiderSimulationInput {
  return {
    id: "rider", name: "Rider", teamId: "team", teamName: "Team",
    teamPrimaryColor: "#173e32", teamSecondaryColor: "#fff", age: 26,
    form: 100, morale: 100, role: "leader",
    climateProfile: { strength: "heat", weakness: "cold" },
    ratings: { mountain, hills: 70, flat: 70, timeTrial: 70, prologue: 70,
      cobbles: 70, sprint: 70, acceleration: 70, downhill: 70,
      endurance: 70, resistance: 70, recovery: 70, breakaway: 70 },
  };
}

function input(stageType: SimulationStageType = "road"): StageSimulationInput {
  return {
    id: "elite-stage", name: "Elite test", seed: "elite-native", stageType,
    profileType: stageType === "road" ? "mountain" : "time_trial", isStageRace: false,
    weather: { condition: "cloudy", rainIntensity: "none", temperatureC: 18,
      windSpeedKph: 0, windDirection: "tailwind", windIntensity: "calm", isWet: false },
    segments: [{ segmentNumber: 1, distanceKm: 2, terrain: "flat", averageGradientPct: 0, surface: "asphalt", prime: null }],
    riders: [rider()],
  };
}

function stage(source = input()): RaceCalendarStage {
  return {
    id: source.id, name: source.name, stageNumber: 1, dayNumber: 1,
    stageType: source.stageType, profileType: source.profileType, status: "planned",
    distanceKm: 2, daySlot: "early", departureAt: null,
    segments: source.stageType === "road"
      ? [{ ...source.segments[0], terrain: "climb", averageGradientPct: 8 }]
      : source.segments,
  };
}

describe("native elite ratings in the real simulation pipeline", () => {
  it.each<SimulationStageType>(["road", "individual_time_trial", "prologue", "team_time_trial"])(
    "preserves the premium after equipment caps in %s and its results-only path",
    (stageType) => {
      const source = input(stageType);
      source.riders[0].ratings = { ...source.riders[0].ratings, mountain: 100, timeTrial: 100, prologue: 100, recovery: 96 };
      source.riders[0].equipmentEffects = { ...EMPTY_EQUIPMENT_EFFECTS, ratingBonuses: { mountain: 6, timeTrial: 5, prologue: 3 } };
      source.riders[0].physiology = { heightCm: 170, weightKg: 59, baselineWeightKg: 59, physiologyVersion: 2 };
      const before = structuredClone(source);
      for (const simulate of [simulateRaceStage, simulateRaceStageResultsOnly]) {
        const resolved = simulate(source).resolvedRiders[0];
        expect(resolved.ratings.mountain).toBe(113.5);
        expect(resolved.ratings.timeTrial).toBe(112.5);
        expect(resolved.ratings.prologue).toBe(110.5);
        expect(resolved.ratings.recovery).toBe(100.5);
        expect(resolved.ratings.hills).toBe(70);
        expect(resolved.physiology?.naturalProfile).toBe(inferRiderPhysiologyProfile(before.riders[0].ratings));
      }
      expect(source).toEqual(before);
    },
  );

  it("does not turn equipment points or a favorite-race bonus into elite native points", () => {
    const source = input();
    source.riders[0].ratings.mountain = 85;
    source.riders[0].equipmentEffects = { ...EMPTY_EQUIPMENT_EFFECTS, ratingBonuses: { mountain: 10 } };
    expect(simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain).toBe(95);
    source.riders[0].favoriteRaceBonus = 2;
    expect(simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain).toBe(97);
  });

  it("keeps existing preparation ceilings while adding only the native premium", () => {
    const source = input();
    source.gameDayIndex = 10;
    source.riders[0].performancePreparations = [{ type: "mountain_base", bonusStartGameDay: 9, bonusEndGameDay: 11, ratingBonus: 3 }];
    source.riders[0].ratings.mountain = 99;
    expect(simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain).toBe(106.75);
    source.riders[0].ratings.mountain = 100;
    expect(simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain).toBe(107.5);
  });

  it("does not amplify an equal equipment increment for a low or elite native rider", () => {
    for (const native of [75, 85, 86, 91, 96, 100]) {
      const source = input();
      source.riders[0].ratings.mountain = native;
      const without = simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain;
      source.riders[0].equipmentEffects = { ...EMPTY_EQUIPMENT_EFFECTS, ratingBonuses: { mountain: 5 } };
      expect(simulateRaceStageResultsOnly(source).resolvedRiders[0].ratings.mountain - without).toBe(5);
    }
  });
});

describe("elite native favorite scores", () => {
  it.each([[74, 75, 1], [85, 86, 1.25], [90, 91, 1.5], [95, 96, 1.75]])(
    "uses the same %s → %s step in public stage favorites and the GC",
    (lower, upper, step) => {
      const mountainStage = stage();
      expect(getStageFavoriteScore(mountainStage, rider(upper)) - getStageFavoriteScore(mountainStage, rider(lower))).toBeCloseTo(0.67 * step, 10);
      expect(getRaceFavoriteScore({ raceFormat: "one_day", stages: [mountainStage] }, rider(upper)))
        .toBe(getStageFavoriteScore(mountainStage, rider(upper)));
      const edition = { raceFormat: "stage_race" as const, stages: [mountainStage] };
      expect(getRaceFavoriteScore(edition, rider(upper)) - getRaceFavoriteScore(edition, rider(lower))).toBeCloseTo(0.67 * 0.94 * step, 10);
    },
  );

  it("applies the intrinsic curve to TTT favorites once and ignores equipment in forecasts", () => {
    const source = input("team_time_trial");
    const high = rider();
    high.ratings.timeTrial = 96;
    const before = structuredClone(high);
    const favorite = buildTeamTimeTrialFavorites({ stage: stage(source), riders: [high] })[0];
    const lower = rider();
    lower.ratings.timeTrial = 95;
    const baseline = buildTeamTimeTrialFavorites({ stage: stage(source), riders: [lower] })[0];
    expect(favorite.score - baseline.score).toBeCloseTo(0.66 * 1.75, 3);
    high.equipmentEffects = { ...EMPTY_EQUIPMENT_EFFECTS, ratingBonuses: { timeTrial: 20 } };
    expect(buildTeamTimeTrialFavorites({ stage: stage(source), riders: [high] })[0].score).toBe(favorite.score);
    expect(high.ratings).toEqual(before.ratings);
  });
});
