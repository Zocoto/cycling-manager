import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { selectStageAttackPlan, simulateRaceStage, type RiderSimulationInput } from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";
import type { RaceStageSegment } from "./race-profiles";

const resultFor = (simulation: ReturnType<typeof simulateRaceStage>, riderId: string) =>
  simulation.results.find((rider) => rider.riderId === riderId)!;

describe("race personality effects", () => {
  it.each([
    { personalityKey: "franc_tireur", seed: 1, riderId: "nordika-4", kind: "solo_effort", savesEnergy: true },
    { personalityKey: "opportuniste", seed: 1, riderId: "lumen-4", kind: "followed_move", savesEnergy: false },
    { personalityKey: "calculateur", seed: 2, riderId: "nordika-6", kind: "saved_reserves", savesEnergy: true },
  ] as const)("shows the actual race effect of $personalityKey with the same course and seed", ({
    personalityKey, seed, riderId, kind, savesEnergy,
  }) => {
    const input = createDemoSimulationInput("collines-ardennes", seed);
    const neutral = simulateRaceStage(input);
    const changed = simulateRaceStage({
      ...input,
      riders: input.riders.map((rider) => rider.id === riderId ? { ...rider, personalityKey } : rider),
    });

    expect(neutral.personalityEvents).toBeUndefined();
    expect(changed.personalityEvents).toMatchObject([{ kind, riderId }]);
    const baselineEnergy = resultFor(neutral, riderId).energyAfter;
    const actualEnergy = resultFor(changed, riderId).energyAfter;
    if (savesEnergy) expect(actualEnergy).toBeGreaterThan(baselineEnergy);
    else expect(actualEnergy).toBeLessThan(baselineEnergy);
    if (personalityKey === "opportuniste") {
      const event = changed.personalityEvents?.[0];
      expect(event).toMatchObject({ targetRiderId: "veloria-6", distanceKm: 111 });
      const nextFrame = changed.visualTimeline?.find(({ completedDistanceKm }) => completedDistanceKm >= 111);
      expect(nextFrame?.groups.some((group) => group.riderIds.includes(riderId) && group.riderIds.includes("veloria-6"))).toBe(true);
    }
  });

  it("picks a willing helper without displacing the designated protector or expanding the escort", () => {
    const input = createDemoSimulationInput("collines-ardennes", 3);
    const teamId = "rescue-team";
    const makeRider = (id: string, rating: number, teamId: string, role: RiderSimulationInput["role"]): RiderSimulationInput => ({
      ...input.riders[0],
      id, name: id, teamId, teamName: teamId, role, form: 78,
      ratings: Object.fromEntries(Object.keys(input.riders[0].ratings).map((key) => [key, rating])) as RiderSimulationInput["ratings"],
    });
    const riders = [
      { ...makeRider("leader", 73, teamId, "leader_sprinter"), form: 72 },
      makeRider("first", 82, teamId, "domestique"),
      makeRider("second", 80, teamId, "domestique"),
      makeRider("third", 78, teamId, "domestique"),
      makeRider("volunteer", 77, teamId, "domestique"),
      ...Array.from({ length: 8 }, (_, i) => makeRider(`rival${i}`, 76, `rival-team${i}`, "leader")),
    ];
    const segments: RaceStageSegment[] = Array.from({ length: 9 }, (_, i) => ({
      segmentNumber: i + 1, distanceKm: i < 2 ? 10 : 18, terrain: i === 1 ? "climb" : "flat",
      averageGradientPct: i === 1 ? 8 : 0, surface: "asphalt", prime: null,
    }));
    const scenario = {
      ...input, id: "rescue-3", profileType: "mountain" as const, riders, segments,
      weather: { ...input.weather!, condition: "clear", windSpeedKph: 5, windIntensity: "calm", rainIntensity: "none", isWet: false } as const,
      teamStrategies: [{
        ...DEFAULT_RACE_TEAM_STRATEGY, teamId, objective: "general_classification",
        breakawayPolicy: "avoid", chasePolicy: "protect_lead", protectorRiderId: "first",
      } as const],
    };
    const ordinary = simulateRaceStage(scenario);
    const changed = simulateRaceStage({
      ...scenario,
      riders: riders.map((rider) => rider.id === "volunteer" ? { ...rider, personalityKey: "solidaire" } : rider),
    });
    const rescueRiders = (simulation: typeof changed) => simulation.teamWork
      ?.filter((period) => period.kind === "recovery" && period.targetRiderIds.includes("leader"))
      .map((period) => period.riderId).sort();

    expect(rescueRiders(ordinary)).toEqual(["first", "second", "third"]);
    expect(rescueRiders(changed)).toEqual(["first", "second", "volunteer"]);
    expect(changed.personalityEvents).toMatchObject([{
      kind: "recovery_support", riderId: "volunteer", targetRiderId: "leader",
    }]);
  });

  it("keeps protected riders and the no-breakaway order outside spontaneous attack selection", () => {
    const input = createDemoSimulationInput("collines-ardennes", 1);
    const rider = {
      ...input.riders[0], form: 100, personalityKey: "franc_tireur", role: "leader",
    } as const;
    const requestedOrder = {
      ...DEFAULT_RACE_TEAM_STRATEGY, teamId: rider.teamId, breakawayPolicy: "avoid",
    } as const;
    const withProtection = selectStageAttackPlan([rider], input.segments, () => 0.99);
    const withOrder = selectStageAttackPlan(
      [{ ...rider, role: "free_agent" }], input.segments, () => 0.99, undefined, [requestedOrder],
    );
    for (const plan of [withProtection, withOrder]) {
      expect(plan.initialAttackIds.has(rider.id)).toBe(false);
      expect(plan.eligibleUnplannedAttackIds.has(rider.id)).toBe(false);
    }
  });

  it("keeps collective time-trial outcomes identical with road personalities", () => {
    const demo = createDemoSimulationInput("chrono-algarve", 4);
    const input = { ...demo, stageType: "team_time_trial" as const };
    const keys = ["franc_tireur", "opportuniste", "calculateur", "solidaire"] as const;
    const original = simulateRaceStage(input);
    const changed = simulateRaceStage({ ...input, riders: input.riders.map((rider, index) => ({ ...rider, personalityKey: keys[index % keys.length] })) });
    expect(changed.results).toEqual(original.results);
    expect(changed.personalityEvents).toBeUndefined();
  });
});
