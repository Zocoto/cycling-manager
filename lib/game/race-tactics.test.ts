import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";
import {
  getRecommendedRaceTacticalDoctrineCodes,
  isRaceTacticalDoctrineEligible,
  isRaceTacticalDoctrineUnlocked,
  validateRaceTacticalAssignments,
} from "./race-tactics";
import type { RaceWeather } from "./race-weather";

const CALM_WEATHER: RaceWeather = {
  condition: "clear",
  rainIntensity: "none",
  temperatureC: 20,
  windSpeedKph: 8,
  windDirection: "headwind",
  windIntensity: "calm",
  isWet: false,
};

const STRONG_CROSSWIND: RaceWeather = {
  ...CALM_WEATHER,
  condition: "wind",
  windSpeedKph: 31,
  windDirection: "crosswind",
  windIntensity: "strong",
};

describe("Centre tactique", () => {
  it("verrouille les doctrines selon le niveau et les conditions réelles", () => {
    expect(isRaceTacticalDoctrineUnlocked("breakaway_control", 1)).toBe(true);
    expect(isRaceTacticalDoctrineUnlocked("sprint_train", 2)).toBe(false);
    expect(
      isRaceTacticalDoctrineEligible({
        code: "crosswind_offensive",
        stageType: "road",
        profileType: "flat",
        weather: CALM_WEATHER,
      }),
    ).toBe(false);
    expect(
      isRaceTacticalDoctrineEligible({
        code: "crosswind_offensive",
        stageType: "road",
        profileType: "flat",
        weather: STRONG_CROSSWIND,
      }),
    ).toBe(true);
    expect(
      getRecommendedRaceTacticalDoctrineCodes({
        stageType: "road",
        profileType: "flat",
        weather: STRONG_CROSSWIND,
        centerLevel: 3,
      })[0],
    ).toBe("crosswind_offensive");
  });

  it("exige le bon nombre de coureurs sans doublon", () => {
    expect(validateRaceTacticalAssignments("sprint_train", ["a", "b", "c", "d"])).toBe(true);
    expect(validateRaceTacticalAssignments("sprint_train", ["a", "b", "c"])).toBe(false);
    expect(validateRaceTacticalAssignments("breakaway_control", ["a", "a"])).toBe(false);
  });

  it("rejoue exactement le même briefing avec la même graine", () => {
    const input = createDemoSimulationInput("sprint-littoral", 971);
    const teamId = input.riders[0]!.teamId;
    const riderIds = input.riders
      .filter((rider) => rider.teamId === teamId)
      .slice(0, 4)
      .map((rider) => rider.id);
    expect(riderIds).toHaveLength(4);

    const tacticalInput = {
      ...input,
      weather: CALM_WEATHER,
      teamTacticalBriefings: [
        {
          teamId,
          primaryDoctrine: "crosswind_offensive" as const,
          primaryRiderIds: riderIds.slice(0, 2),
          backupDoctrine: "sprint_train" as const,
          backupRiderIds: riderIds,
          centerLevel: 4,
        },
      ],
    };
    const first = simulateRaceStage(tacticalInput);
    const replay = simulateRaceStage(tacticalInput);

    expect(replay).toEqual(first);
    expect(first.tacticalReports).toHaveLength(1);
    expect(first.tacticalReports?.[0]).toMatchObject({
      teamId,
      requestedDoctrine: "crosswind_offensive",
      appliedDoctrine: "sprint_train",
      source: "backup",
      triggered: true,
    });
    expect(first.tacticalReports?.[0].energyCosts).toEqual(
      riderIds.slice(1).map((riderId) => ({ riderId, percentage: 8 })),
    );
  });
});
