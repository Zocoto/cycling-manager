import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  normalizeTeamTimeTrialRelayShares,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";

describe("time-trial race preparation", () => {
  it("renormalizes the initial relay shares when a rider is dropped", () => {
    const relayPlanEntries: Array<[string, number]> = [
        ["sprinter", 50],
        ["rouleur-1", 15],
        ["rouleur-2", 15],
        ["rouleur-3", 15],
        ["leader", 5],
    ];
    const plans = Object.fromEntries(
      relayPlanEntries.map(([riderId, relaySharePct]) => [
        riderId,
        {
          effortMode: "normal",
          relaySharePct,
        } satisfies TimeTrialRiderPlan,
      ]),
    );

    const normalized = normalizeTeamTimeTrialRelayShares(
      ["rouleur-1", "rouleur-2", "rouleur-3", "leader"],
      plans,
    );

    expect(normalized["rouleur-1"]).toBeCloseTo(0.3, 8);
    expect(normalized["rouleur-2"]).toBeCloseTo(0.3, 8);
    expect(normalized["rouleur-3"]).toBeCloseTo(0.3, 8);
    expect(normalized.leader).toBeCloseTo(0.1, 8);
  });

  it("makes all-in faster but more tiring than conserving energy", () => {
    const baseInput = createDemoSimulationInput("chrono-algarve", 87);
    const rider = baseInput.riders[0];
    const simulateEffort = (effortMode: "conserve" | "all_in") =>
      simulateRaceStage({
        ...baseInput,
        riders: [rider],
        timeTrialPlans: {
          [rider.id]: { effortMode, relaySharePct: null },
        },
      }).results[0];

    const conserving = simulateEffort("conserve");
    const allIn = simulateEffort("all_in");

    expect(allIn.elapsedTimeSeconds).toBeLessThan(
      conserving.elapsedTimeSeconds,
    );
    expect(allIn.energyAfter).toBeLessThan(conserving.energyAfter);
  });

  it("records individual times when riders lose the team time-trial group", () => {
    const baseInput = createDemoSimulationInput("chrono-algarve", 103);
    const riders = [
      createRider("sprinter", { timeTrial: 48, endurance: 48, resistance: 45 }),
      createRider("rouleur-1", { timeTrial: 88, endurance: 84, resistance: 82 }),
      createRider("rouleur-2", { timeTrial: 86, endurance: 82, resistance: 80 }),
      createRider("rouleur-3", { timeTrial: 84, endurance: 80, resistance: 78 }),
      createRider("leader", { timeTrial: 56, endurance: 72, resistance: 70 }),
    ];
    const relayShares: Record<string, number> = {
      sprinter: 50,
      "rouleur-1": 15,
      "rouleur-2": 15,
      "rouleur-3": 15,
      leader: 5,
    };
    const timeTrialPlans = Object.fromEntries(
      riders.map((rider) => [
        rider.id,
        {
          effortMode: rider.id === "sprinter" ? "all_in" : "normal",
          relaySharePct: relayShares[rider.id],
        } satisfies TimeTrialRiderPlan,
      ]),
    );

    const simulation = simulateRaceStage({
      ...baseInput,
      stageType: "team_time_trial",
      riders,
      timeTrialPlans,
    });

    expect(
      simulation.timeline.some((snapshot) =>
        snapshot.groups.some((group) => group.type === "dropped"),
      ),
    ).toBe(true);
    expect(
      new Set(
        simulation.results.map((result) => result.elapsedTimeSeconds),
      ).size,
    ).toBeGreaterThan(1);
  });
});

function createRider(
  id: string,
  ratings: Partial<RiderSimulationInput["ratings"]>,
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: "team-a",
    teamName: "Équipe A",
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 27,
    form: 78,
    role: "free_agent",
    ratings: {
      flat: 70,
      mountain: 60,
      hills: 65,
      cobbles: 65,
      downhill: 65,
      sprint: 65,
      acceleration: 65,
      timeTrial: 70,
      prologue: 70,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 65,
      ...ratings,
    },
  };
}
