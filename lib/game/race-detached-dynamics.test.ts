import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { getDetachedRiderTerrainLoss, mergeDetachedGroupsAfterCatch, resolveNearbyDetachedGroupLatching, simulateRaceStage } from "./race-simulation";
import type { RaceStageSegment } from "./race-profiles";

type CatchInput = Parameters<typeof mergeDetachedGroupsAfterCatch>[0];
type CatchState = CatchInput["states"] extends Map<string, infer T> ? T : never;

const climb: RaceStageSegment = {
  segmentNumber: 3,
  distanceKm: 12,
  terrain: "climb",
  averageGradientPct: 6,
  surface: "asphalt",
  prime: null,
};

function state(id: string, group: CatchState["group"], clock: number, mountain = 88): CatchState {
  const rider = createDemoSimulationInput("haute-montagne", 1).riders[0];
  return {
    rider: {
      ...rider,
      id,
      name: id,
      role: "domestique",
      form: 95,
      ratings: { ...rider.ratings, mountain, hills: mountain, flat: mountain },
    },
    group,
    energy: 60,
    elapsedTimeSeconds: clock,
    lostTimeSeconds: clock - 1100,
    groupSinceSegment: 1,
    raceDayExecutionBonus: 0,
    cobblesSectorExecutionBonus: 0,
    decisiveAttackBonus: 0,
    injuryPerformancePenalty: 0,
    finalSprintCrashFinishPenalty: 0,
  };
}

function runCatch(catchers: CatchState[], caught: CatchState[], starts: Record<string, number>) {
  const peloton = state("peloton", "peloton", 1100);
  const states = new Map([peloton, ...catchers, ...caught].map((rider) => [rider.rider.id, rider]));
  mergeDetachedGroupsAfterCatch({
    states,
    segment: climb,
    segmentIndex: 2,
    profileType: "mountain",
    hillyClimbLoad: 0,
    detachedGroupsAtSegmentStart: [{
      riderIds: new Set(catchers.map((rider) => rider.rider.id)),
      elapsedTimeSeconds: catchers.reduce((sum, rider) => sum + starts[rider.rider.id], 0) / catchers.length,
    }],
    detachedElapsedTimeAtSegmentStartByRiderId: new Map(Object.entries(starts)),
    commentary: [],
  });
}

describe("rattrapage physique des groupes détachés", () => {
  it("ne laisse pas un grimpeur à énergie nulle conserver indéfiniment l'allure de tête", () => {
    const input = createDemoSimulationInput("haute-montagne", 5);
    const riders = input.riders.slice(0, 7).map((rider, index) => ({
      ...rider,
      role: "leader" as const,
      teamId: `exhausted-climb-team-${index}`,
      form: index === 0 ? 5 : 100,
      ratings: {
        ...rider.ratings,
        mountain: index === 0 ? 100 : 74,
        hills: index === 0 ? 100 : 74,
        endurance: index === 0 ? 20 : 90,
        resistance: index === 0 ? 20 : 90,
      },
    }));
    const simulation = simulateRaceStage({
      ...input,
      riders,
      segments: [
        { ...climb, segmentNumber: 1, distanceKm: 1, terrain: "flat", averageGradientPct: 0 },
        ...Array.from({ length: 5 }, (_, index) => ({ ...climb, segmentNumber: index + 2, distanceKm: 10 })),
      ],
    });
    const targetId = riders[0].id;
    const gaps = simulation.timeline.slice(1, -1).map((snapshot) =>
      snapshot.groups.find((group) => group.riderIds.includes(targetId))!.gapToLeaderSeconds,
    );
    expect(gaps[0]).toBeGreaterThan(0);
    expect(gaps[1]).toBeGreaterThan(gaps[0]);
    expect(gaps[2]).toBeGreaterThan(gaps[1]);
  });

  it.each([
    { terrain: "climb" as const, surface: "asphalt" as const },
    { terrain: "flat" as const, surface: "cobbles" as const },
  ])("une énergie nulle interdit l'allure de tête sur $terrain/$surface même à note supérieure", ({ terrain, surface }) => {
    const base = {
      riderTerrainRating: 90,
      fieldTerrainRating: 80,
      selectionDifficulty: 1.1,
      terrain,
      surface,
      recoveryRoll: 0.5,
    };
    expect(getDetachedRiderTerrainLoss({ ...base, energy: 60 })).toBe(0);
    expect(getDetachedRiderTerrainLoss({ ...base, energy: 0.8 })).toBeGreaterThan(10);
    expect(getDetachedRiderTerrainLoss({ ...base, energy: 0 })).toBeGreaterThan(
      getDetachedRiderTerrainLoss({ ...base, energy: 0.8 }),
    );
  });

  it("prend les roues d'un groupe voisin sans transformer le motif d'un lâchage en incident", () => {
    const peloton = state("peloton", "peloton", 1100);
    const incident = state("incident", "delayed", 1200);
    const incidentTwo = state("incident-two", "delayed", 1222);
    const incidentThree = state("incident-three", "delayed", 1224);
    const target = state("target", "dropped", 1225);
    const states = new Map([peloton, incident, incidentTwo, incidentThree, target].map((rider) => [rider.rider.id, rider]));
    // Physical grouping spans24s. On a descent a fresh rider may make the
    // remaining short effort to latch, but retains the physical-drop cause.
    target.rider.role = "leader";
    resolveNearbyDetachedGroupLatching({
      states,
      segment: { ...climb, terrain: "descent", averageGradientPct: -6 },
      segmentIndex: 2,
      profileType: "mountain",
      hillyClimbLoad: 0,
      commentary: [],
    });
    expect(target.group).toBe("dropped");
    expect(incident.group).toBe("delayed");
    expect(target.elapsedTimeSeconds).toBeLessThan(1225);
    expect(target.energy).toBeLessThan(60);
  });

  it("permet une vraie jonction sans réécrire les horloges des poursuivants ni transmettre leur motif de retard", () => {
    const catchers = [state("incident", "delayed", 1200), state("dropped", "dropped", 1210)];
    const target = state("target", "dropped", 1280);
    runCatch(catchers, [target], { incident: 1100, dropped: 1100, target: 1050 });

    expect(catchers.map((rider) => rider.elapsedTimeSeconds)).toEqual([1200, 1210]);
    expect(catchers.map((rider) => rider.group)).toEqual(["delayed", "dropped"]);
    expect(target.elapsedTimeSeconds).toBe(1205);
    expect(target.elapsedTimeSeconds).toBeGreaterThan(1050);
    expect(target.lostTimeSeconds).toBe(105);
    expect(target.group).toBe("dropped");
  });

  it("ne fusionne pas un coureur qui reste réellement devant à la fin du secteur", () => {
    const catchers = [state("a", "delayed", 1200), state("b", "delayed", 1210)];
    const target = state("target", "dropped", 1180);
    runCatch(catchers, [target], { a: 1100, b: 1100, target: 1050 });
    expect(target.elapsedTimeSeconds).toBe(1180);
    expect(target.groupSinceSegment).toBe(1);
  });

  it("laisse décrocher un coureur incapable de suivre le groupe qui le reprend", () => {
    const catchers = [state("a", "delayed", 1200), state("b", "delayed", 1210)];
    const target = state("target", "dropped", 1280, 40);
    runCatch(catchers, [target], { a: 1100, b: 1100, target: 1050 });
    expect(target.elapsedTimeSeconds).toBe(1280);
    expect(target.groupSinceSegment).toBe(1);
  });

  it("préserve l'attente d'un équipier auprès de son leader incapable de suivre", () => {
    const catchers = [state("a", "delayed", 1200), state("b", "delayed", 1210)];
    const leader = state("leader", "dropped", 1280, 40);
    const helper = state("helper", "dropped", 1280);
    helper.supportingLeaderId = leader.rider.id;
    runCatch(catchers, [leader, helper], { a: 1100, b: 1100, leader: 1050, helper: 1050 });
    expect([leader.elapsedTimeSeconds, helper.elapsedTimeSeconds]).toEqual([1280, 1280]);
    expect(helper.supportingLeaderId).toBe(leader.rider.id);
  });

  it("utilise le départ du sous-groupe qui reprend après une scission", () => {
    const catchers = [state("a", "delayed", 1200), state("b", "delayed", 1202), state("slow", "delayed", 1300)];
    const target = state("target", "dropped", 1250);
    runCatch(catchers, [target], { a: 1100, b: 1102, slow: 1124, target: 1106 });
    // The fast pair was already ahead of this rider at sector entry. The
    // slower third rider cannot turn that pair into a fictitious rear group.
    expect(target.elapsedTimeSeconds).toBe(1250);
  });
});
