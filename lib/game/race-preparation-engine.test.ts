import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  selectStageAttackPlan,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";

describe("race preparation engine", () => {
  it("prioritizes the designated breakaway rider and preserves planned attacks", () => {
    const breakawayRider = createRider("breakaway", "team-a", {
      breakaway: 72,
      acceleration: 70,
      endurance: 72,
    });
    breakawayRider.raceDuty = "breakaway_candidate";
    const plannedAttacker = createRider("attacker", "team-a", {
      acceleration: 82,
    });
    const rivals = Array.from({ length: 7 }, (_, index) =>
      createRider(`rival-${index}`, `team-${index + 2}`, {
        breakaway: 74 + index,
      }),
    );
    const input = createDemoSimulationInput("classique-ardennaise", 11);
    const targetSegment = input.segments.at(-2)!;
    const attackOrder = {
      riderId: plannedAttacker.id,
      segmentNumber: targetSegment.segmentNumber,
      intensity: "strong" as const,
      condition: "high_energy" as const,
    };

    const plan = selectStageAttackPlan(
      [breakawayRider, plannedAttacker, ...rivals],
      input.segments,
      () => 0.5,
      undefined,
      [
        {
          teamId: "team-a",
          ...DEFAULT_RACE_TEAM_STRATEGY,
          objective: "breakaway",
          breakawayPolicy: "target",
          breakawayRiderId: breakawayRider.id,
          attackOrders: [attackOrder],
        },
      ],
    );

    expect(plan.initialAttackIds.has(breakawayRider.id)).toBe(true);
    expect(plan.initialAttackIds.has(plannedAttacker.id)).toBe(false);
    expect(plan.strategyAttackOrders).toEqual([
      { ...attackOrder, teamId: "team-a" },
    ]);
  });

  it("rejects duplicated missions before starting a simulation", () => {
    const input = createDemoSimulationInput("sprint-littoral", 7);
    const teamId = input.riders[0].teamId;
    const riderId = input.riders[0].id;

    expect(() =>
      simulateRaceStage({
        ...input,
        teamStrategies: [
          {
            teamId,
            ...DEFAULT_RACE_TEAM_STRATEGY,
            lieutenantRiderId: riderId,
            protectorRiderId: riderId,
          },
        ],
      }),
    ).toThrow("cumuler deux missions tactiques");
  });
});

function createRider(
  id: string,
  teamId: string,
  ratings: Partial<RiderSimulationInput["ratings"]> = {},
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId,
    teamName: teamId,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 78,
    role: "free_agent",
    ratings: {
      flat: 65,
      mountain: 65,
      hills: 65,
      cobbles: 65,
      downhill: 65,
      sprint: 65,
      acceleration: 65,
      timeTrial: 65,
      prologue: 65,
      endurance: 65,
      resistance: 65,
      recovery: 65,
      breakaway: 65,
      ...ratings,
    },
  };
}
