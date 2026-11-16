import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { selectStageAttackPlan, simulateRaceStage, type RiderSimulationInput } from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";
import type { RaceStageSegment } from "./race-profiles";
import type { RiderPersonalityKey } from "./rider-personalities";

const resultFor = (simulation: ReturnType<typeof simulateRaceStage>, riderId: string) =>
  simulation.results.find((rider) => rider.riderId === riderId)!;

function withPersonality(
  input: Parameters<typeof simulateRaceStage>[0],
  riderId: string,
  personalityKey: RiderPersonalityKey,
) {
  return {
    ...input,
    riders: input.riders.map((rider) => rider.id === riderId ? { ...rider, personalityKey } : rider),
  };
}

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

  it("uses one deterministic finish fluctuation on the chosen road stage", () => {
    const riderId = "lumen-2";
    const input = { ...createDemoSimulationInput("sprint-littoral", 1), isStageRace: true };
    const neutral = simulateRaceStage(input);
    const earlier = simulateRaceStage(withPersonality({ ...input, isFinalRoadStage: false }, riderId, "imprevisible"));
    const chosenInput = withPersonality({ ...input, isFinalRoadStage: true }, riderId, "imprevisible");
    const changed = simulateRaceStage(chosenInput);

    expect(earlier.results).toEqual(neutral.results);
    expect(earlier.personalityEvents).toBeUndefined();
    expect(changed.personalityEvents).toEqual([
      { kind: "finish_fluctuation", riderId, distanceKm: 154, effect: "negative" },
    ]);
    expect(resultFor(changed, riderId).rank).toBeGreaterThan(resultFor(neutral, riderId).rank!);
    expect(simulateRaceStage(chosenInput).results).toEqual(changed.results);
  });

  it("lets Fonceur commit to a valid counterattack at an energy cost", () => {
    const riderId = "veloria-6";
    const input = createDemoSimulationInput("collines-ardennes", 7);
    const neutral = simulateRaceStage(input);
    const changed = simulateRaceStage(withPersonality(input, riderId, "fonceur"));

    expect(changed.personalityEvents).toEqual([{ kind: "seized_counterattack", riderId, distanceKm: 141 }]);
    expect(resultFor(changed, riderId).energyAfter).toBeLessThan(resultFor(neutral, riderId).energyAfter);
    const midAttackGroup = (simulation: typeof changed) => simulation.visualTimeline
      ?.find((frame) => frame.completedDistanceKm >= 141)
      ?.groups.find(({ riderIds }) => riderIds.includes(riderId))?.type;
    expect(midAttackGroup(neutral)).toBe("peloton");
    expect(["chase", "breakaway"]).toContain(midAttackGroup(changed));
  });

  it("lets Régulier preserve energy while completing the same team relay", () => {
    const riderId = "veloria-1";
    const input = { ...createDemoSimulationInput("chrono-algarve", 1), stageType: "team_time_trial" as const };
    const neutral = simulateRaceStage(input);
    const changed = simulateRaceStage(withPersonality(input, riderId, "metronome"));

    expect(changed.personalityEvents).toEqual([{ kind: "steady_relay", riderId, distanceKm: 0 }]);
    expect(resultFor(changed, riderId).energyAfter).toBeGreaterThan(resultFor(neutral, riderId).energyAfter);
    expect(resultFor(changed, riderId).elapsedTimeSeconds).toBe(resultFor(neutral, riderId).elapsedTimeSeconds);
  });

  it("lets Tenace cut a realistic gap at the expense of remaining energy", () => {
    const riderId = "veloria-6";
    const input = createDemoSimulationInput("haute-montagne", 1);
    const neutral = simulateRaceStage(input);
    const changed = simulateRaceStage(withPersonality(input, riderId, "tenace"));

    expect(changed.personalityEvents).toEqual([{ kind: "sustained_pursuit", riderId, distanceKm: 160 }]);
    expect(resultFor(changed, riderId).gapToWinnerSeconds).toBeLessThan(resultFor(neutral, riderId).gapToWinnerSeconds);
    expect(resultFor(changed, riderId).energyAfter).toBeLessThan(resultFor(neutral, riderId).energyAfter);
  });

  it("lets Prudent avoid an individual crash on a wet technical sector", () => {
    const riderId = "sol-del-sur-1";
    const demo = createDemoSimulationInput("paves-zelande", 14);
    const input = {
      ...demo,
      weather: { ...demo.weather!, isWet: true, condition: "rain", rainIntensity: "steady" } as const,
    };
    const neutral = simulateRaceStage(input);
    const changed = simulateRaceStage(withPersonality(input, riderId, "prudent"));
    const crashes = (simulation: typeof changed) => simulation.timeline.flatMap((frame) => frame.incidents)
      .filter((incident) => incident.type === "crash_individual" && incident.riderIds.includes(riderId));

    expect(changed.personalityEvents).toContainEqual({ kind: "avoided_wet_crash", riderId, distanceKm: 150 });
    expect(crashes(neutral)).toHaveLength(1);
    expect(crashes(changed)).toHaveLength(0);
    expect(resultFor(changed, riderId).energyAfter).toBeGreaterThan(resultFor(neutral, riderId).energyAfter);
  });
});
