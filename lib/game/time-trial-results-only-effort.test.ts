import { describe, expect, it } from "vitest";

import {
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type StageSimulationInput,
} from "./race-simulation";
import type { TimeTrialEffortMode } from "./time-trial-preparation";

function rider(id: string, chrono = 75): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: id,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#ffffff",
    age: 27,
    form: 90,
    morale: 50,
    role: "auto",
    ratings: {
      flat: 70,
      mountain: 70,
      hills: 70,
      cobbles: 70,
      downhill: 70,
      sprint: 70,
      acceleration: 70,
      timeTrial: chrono,
      prologue: chrono,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 70,
    },
  };
}

function input(
  stageType: StageSimulationInput["stageType"] = "individual_time_trial",
  distanceKm = 40,
  seed = 17,
): StageSimulationInput {
  return {
    id: "national-time-trial-effort",
    name: "CN chrono",
    stageType,
    profileType: stageType === "road" ? "flat" : "time_trial",
    isStageRace: false,
    seed,
    weather: {
      condition: "clear",
      rainIntensity: "none",
      temperatureC: 20,
      windSpeedKph: 0,
      windDirection: "headwind",
      windIntensity: "calm",
      isWet: false,
    },
    segments: [{
      segmentNumber: 1,
      distanceKm,
      terrain: "flat",
      averageGradientPct: 0,
      surface: "asphalt",
      prime: null,
    }],
    riders: [rider("chrono")],
  };
}

function withEffort(source: StageSimulationInput, effortMode: TimeTrialEffortMode) {
  return {
    ...source,
    timeTrialPlans: Object.fromEntries(source.riders.map((row) => [row.id, {
      effortMode,
      relaySharePct: null,
    }])),
  };
}

describe("CN results-only individual time-trial effort", () => {
  it.each(["individual_time_trial", "prologue"] as const)(
    "makes all-in faster and more tiring without ignoring conservation in %s",
    (stageType) => {
      const source = input(stageType);
      const original = structuredClone(source);
      const [conserve, normal, allIn] = (["conserve", "normal", "all_in"] as const)
        .map((mode) => simulateRaceStageResultsOnly(withEffort(source, mode)));

      expect(allIn.results[0].elapsedTimeSeconds).toBeLessThan(normal.results[0].elapsedTimeSeconds);
      expect(normal.results[0].elapsedTimeSeconds).toBeLessThan(conserve.results[0].elapsedTimeSeconds);
      expect(allIn.results[0].energyAfter).toBeLessThan(normal.results[0].energyAfter);
      expect(normal.results[0].energyAfter).toBeLessThan(conserve.results[0].energyAfter);
      expect(allIn.timeline).toEqual([]);
      expect(allIn.primes).toEqual([]);
      expect(allIn).toEqual(simulateRaceStageResultsOnly(withEffort(source, "all_in")));
      expect(source).toEqual(original);
    },
  );

  it.each(["individual_time_trial", "prologue"] as const)(
    "keeps absent plans byte-identical to the existing normal result for %s",
    (stageType) => {
      const source = input(stageType);
      const missing = simulateRaceStageResultsOnly(source);
      const normal = simulateRaceStageResultsOnly(withEffort(source, "normal"));

      expect(JSON.stringify(missing)).toBe(JSON.stringify(normal));
      expect(normal.results).toEqual([{
        riderId: "chrono",
        rank: 1,
        status: "finished",
        elapsedTimeSeconds: 3349,
        gapToWinnerSeconds: 0,
        energyAfter: 83.33,
        injury: null,
        abandonment: null,
      }]);
    },
  );

  it.each([5, 12, 25, 40, 60])(
    "does not erase a 61 versus 75 skill gap over %i km",
    (distanceKm) => {
      for (const stageType of ["individual_time_trial", "prologue"] as const) {
        for (let seed = 0; seed < 64; seed += 1) {
          const riders = [rider("weaker", 61), rider("stronger", 75)];
          if (seed % 2 === 0) riders.reverse();
          const result = simulateRaceStageResultsOnly({
            ...input(stageType, distanceKm, seed),
            riders,
            timeTrialPlans: {
              weaker: { effortMode: "all_in", relaySharePct: null },
              stronger: { effortMode: "normal", relaySharePct: null },
            },
          });
          expect(result.results[0].riderId).toBe("stronger");
          expect(result.results[1].gapToWinnerSeconds).toBeGreaterThan(0);
        }
      }
    },
  );

  it("does not apply the weather and infrastructure energy reduction twice", () => {
    const source = input();
    source.riders[0] = {
      ...source.riders[0],
      weatherCenterSpecialization: { code: "normal_weather", infrastructureLevel: 5 },
      windTunnelSpecialization: { code: "solo_aero", infrastructureLevel: 5 },
    };
    const normal = simulateRaceStageResultsOnly(source).results[0];
    const allIn = simulateRaceStageResultsOnly(withEffort(source, "all_in")).results[0];
    expect(normal.energyAfter).toBe(83.6);
    expect(allIn.energyAfter).toBe(81.04);
  });

  it("can change a close classification naturally without forcing a skill-based ranking", () => {
    let improvedPlacings = 0;
    for (let seed = 0; seed < 64; seed += 1) {
      const source = { ...input("individual_time_trial", 40, seed), riders: [rider("first"), rider("second")] };
      const normal = simulateRaceStageResultsOnly(source);
      const contender = normal.results[1].riderId;
      const changed = simulateRaceStageResultsOnly({
        ...source,
        timeTrialPlans: { [contender]: { effortMode: "all_in", relaySharePct: null } },
      });
      if (changed.results[0].riderId === contender) improvedPlacings += 1;
    }
    expect(improvedPlacings).toBeGreaterThan(0);
    expect(improvedPlacings).toBeLessThan(64);
  });

  it("keeps the collective results-only path unchanged rather than inventing TTT relay mechanics", () => {
    const source = input("team_time_trial");
    const normal = simulateRaceStageResultsOnly(source);
    const allIn = simulateRaceStageResultsOnly(withEffort(source, "all_in"));
    expect(JSON.stringify(allIn)).toBe(JSON.stringify(normal));
  });

  it("preserves road results and the existing refusal of time-trial plans on the road", () => {
    const source = input("road");
    const original = structuredClone(source);
    const result = simulateRaceStageResultsOnly(source);
    expect(JSON.stringify(result)).toBe(JSON.stringify(simulateRaceStageResultsOnly(source)));
    expect(result.results[0]).toMatchObject({
      elapsedTimeSeconds: 3349,
      energyAfter: 83.33,
      rank: 1,
    });
    expect(() => simulateRaceStageResultsOnly(withEffort(source, "all_in")))
      .toThrow("Une préparation chrono ne peut viser qu’un contre-la-montre.");
    expect(source).toEqual(original);
  });
});
