import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  normalizeTeamTimeTrialRelayShares,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";

describe("time-trial race preparation", () => {
  it("renormalizes configured relay shares", () => {
    const plans = {
      strong: { effortMode: "normal", relaySharePct: 70 },
      weak: { effortMode: "normal", relaySharePct: 20 },
      reserve: { effortMode: "normal", relaySharePct: 10 },
    } satisfies Record<string, TimeTrialRiderPlan>;

    const normalized = normalizeTeamTimeTrialRelayShares(
      ["strong", "reserve"],
      plans,
    );

    expect(normalized.strong).toBeCloseTo(0.875, 8);
    expect(normalized.reserve).toBeCloseTo(0.125, 8);
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

  it("defaults unplanned riders to normal effort in an individual time trial", () => {
    const baseInput = createDemoSimulationInput("chrono-algarve", 91);

    expect(() =>
      simulateRaceStage({
        ...baseInput,
        riders: baseInput.riders.slice(0, 3),
        timeTrialPlans: {
          [baseInput.riders[0].id]: {
            effortMode: "all_in",
            relaySharePct: null,
          },
        },
      }),
    ).not.toThrow();
  });

  it("uses relay shares to build the team time-trial pace", () => {
    const baseInput = createDemoSimulationInput("chrono-algarve", 103);
    const strong = createRider("strong", 88);
    const weak = createRider("weak", 52);
    const simulateRelays = (strongShare: number) =>
      simulateRaceStage({
        ...baseInput,
        stageType: "team_time_trial",
        riders: [strong, weak],
        timeTrialPlans: {
          strong: {
            effortMode: "normal",
            relaySharePct: strongShare,
          },
          weak: {
            effortMode: "normal",
            relaySharePct: 100 - strongShare,
          },
        },
      }).results[0];

    expect(simulateRelays(80).elapsedTimeSeconds).toBeLessThan(
      simulateRelays(20).elapsedTimeSeconds,
    );
  });

  it("records individual times when riders lose the team time-trial group", () => {
    const baseInput = createDemoSimulationInput("chrono-algarve", 103);
    const riders = [
      createDetailedRider("sprinter", {
        timeTrial: 48,
        endurance: 48,
        resistance: 45,
      }),
      createDetailedRider("rouleur-1", {
        timeTrial: 88,
        endurance: 84,
        resistance: 82,
      }),
      createDetailedRider("rouleur-2", {
        timeTrial: 86,
        endurance: 82,
        resistance: 80,
      }),
      createDetailedRider("rouleur-3", {
        timeTrial: 84,
        endurance: 80,
        resistance: 78,
      }),
      createDetailedRider("leader", {
        timeTrial: 56,
        endurance: 72,
        resistance: 70,
      }),
    ];
    const relayShares: Record<string, number> = {
      sprinter: 50,
      "rouleur-1": 15,
      "rouleur-2": 15,
      "rouleur-3": 15,
      leader: 5,
    };

    const simulation = simulateRaceStage({
      ...baseInput,
      stageType: "team_time_trial",
      riders,
      timeTrialPlans: Object.fromEntries(
        riders.map((rider) => [
          rider.id,
          {
            effortMode: rider.id === "sprinter" ? "all_in" : "normal",
            relaySharePct: relayShares[rider.id],
          } satisfies TimeTrialRiderPlan,
        ]),
      ),
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

function createRider(id: string, timeTrial: number): RiderSimulationInput {
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
      timeTrial,
      prologue: timeTrial,
      endurance: 72,
      resistance: 70,
      recovery: 70,
      breakaway: 65,
    },
  };
}

function createDetailedRider(
  id: string,
  ratings: Partial<RiderSimulationInput["ratings"]>,
) {
  const rider = createRider(id, ratings.timeTrial ?? 70);
  return {
    ...rider,
    ratings: {
      ...rider.ratings,
      ...ratings,
    },
  };
}
