import { describe, expect, it } from "vitest";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage, simulateRaceStageResultsOnly } from "./race-simulation";
import { getRiderWeightThreshold } from "./rider-physiology";
import { EMPTY_EQUIPMENT_EFFECTS } from "./equipment";

describe("weight curve in the simulation pipeline", () => {
  it.each([
    ["paves-zelande", "northern_classics", "cobbles"],
    ["sprint-littoral", "sprinter", "sprint"],
    ["chrono-algarve", "rouleur", "timeTrial"],
  ] as const)("makes excessive weight worse in a deterministic %s simulation", (scenario, profile, ratingKey) => {
    const input = structuredClone(createDemoSimulationInput(scenario, "weight-curve-integration"));
    const targetId = input.riders[0].id;
    for (const rider of input.riders) {
      for (const key of Object.keys(rider.ratings) as Array<keyof typeof rider.ratings>) rider.ratings[key] = 50;
      rider.ratings[ratingKey] = 95;
      rider.form = 100;
    }
    const threshold = getRiderWeightThreshold(profile, 180).maximumBodyMassIndex;
    input.riders[0].physiology = {
      heightCm: 180, weightKg: threshold * 1.8 ** 2, baselineWeightKg: 60, physiologyVersion: 0,
    };
    const normal = simulateRaceStageResultsOnly(input);
    const heavier = structuredClone(input);
    heavier.riders[0].physiology!.weightKg = 30 * 1.8 ** 2;
    const overweight = simulateRaceStageResultsOnly(heavier);
    const before = normal.results.find((rider) => rider.riderId === targetId)!;
    const after = overweight.results.find((rider) => rider.riderId === targetId)!;
    expect(after.elapsedTimeSeconds).toBeGreaterThan(before.elapsedTimeSeconds);
    expect(after.rank!).toBeGreaterThanOrEqual(before.rank!);
    expect(overweight.resolvedRiders[0].physiology?.naturalProfile).toBe(profile);
    expect(input.riders[0].physiology.naturalProfile).toBeUndefined();
    expect(heavier.riders[0].ratings).toEqual(input.riders[0].ratings);
  });

  it("locks the natural profile before equipment bonuses also in the full live simulation", () => {
    const input = structuredClone(createDemoSimulationInput("sprint-littoral", "weight-profile-lock"));
    const target = input.riders[0];
    for (const key of Object.keys(target.ratings) as Array<keyof typeof target.ratings>) target.ratings[key] = 50;
    target.ratings.sprint = 95;
    target.physiology = { heightCm: 180, weightKg: 80, baselineWeightKg: 70, physiologyVersion: 0 };
    target.equipmentEffects = { ...EMPTY_EQUIPMENT_EFFECTS, ratingBonuses: { mountain: 80 } };
    const simulation = simulateRaceStage(input);
    const resolved = simulation.resolvedRiders.find((rider) => rider.id === target.id)!;
    expect(resolved.physiology?.naturalProfile).toBe("sprinter");
    expect(resolved.ratings.mountain).toBeGreaterThan(resolved.ratings.sprint);
    expect(target.physiology.naturalProfile).toBeUndefined();
    expect(simulation.results).toHaveLength(input.riders.length);
  });
});
