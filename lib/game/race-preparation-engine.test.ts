import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  assignRaceObjectiveDuties,
  getMountainObjectiveRiderIdsByTeam,
  getRaceObjectiveControllingTeamIds,
  getStageAttackParticipants,
  getStageWinObjectiveMode,
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
    const input = createDemoSimulationInput("collines-ardennes", 11);
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

  it("gives the lieutenant the full former leader-protection effect", () => {
    const input = createDemoSimulationInput("sprint-littoral", 19);
    const helper = input.riders[0];

    const lieutenantResult = simulateRaceStage({
      ...input,
      teamStrategies: [
        {
          teamId: helper.teamId,
          ...DEFAULT_RACE_TEAM_STRATEGY,
          lieutenantRiderId: helper.id,
        },
      ],
    });
    const legacyProtectorResult = simulateRaceStage({
      ...input,
      teamStrategies: [
        {
          teamId: helper.teamId,
          ...DEFAULT_RACE_TEAM_STRATEGY,
          protectorRiderId: helper.id,
        },
      ],
    });

    expect(lieutenantResult).toEqual(legacyProtectorResult);
  });

  it("routes a stage-win objective through the sprint or the breakaway", () => {
    const sprintInput = createDemoSimulationInput("sprint-littoral", 31);
    const hillyInput = createDemoSimulationInput("collines-ardennes", 31);
    const teamId = hillyInput.riders[0].teamId;
    const strategy = {
      teamId,
      ...DEFAULT_RACE_TEAM_STRATEGY,
      objective: "stage_win" as const,
    };

    expect(getStageWinObjectiveMode(sprintInput.segments)).toBe("sprint");
    expect(getStageWinObjectiveMode(hillyInput.segments)).toBe("breakaway");

    const hillyRiders = assignRaceObjectiveDuties({
      ...hillyInput,
      teamStrategies: [strategy],
    });
    const stageWinCandidates = hillyRiders.filter(
      (rider) =>
        rider.teamId === teamId &&
        rider.raceDuty === "breakaway_candidate",
    );

    expect(stageWinCandidates).toHaveLength(1);
    expect(stageWinCandidates[0].role).not.toBe("leader");
    expect(stageWinCandidates[0].role).not.toBe("sprinter");
  });

  it("controls the peloton only for the sprint route to a stage win", () => {
    const stageWinStrategy = {
      teamId: "team-a",
      ...DEFAULT_RACE_TEAM_STRATEGY,
      objective: "stage_win" as const,
    };
    const mountainStrategy = {
      teamId: "team-a",
      ...DEFAULT_RACE_TEAM_STRATEGY,
      objective: "mountain_points" as const,
    };

    expect(
      getRaceObjectiveControllingTeamIds({
        baseControllingTeamIds: new Set(),
        teamStrategies: [stageWinStrategy],
        likelyMassSprint: true,
      }).has("team-a"),
    ).toBe(true);
    expect(
      getRaceObjectiveControllingTeamIds({
        baseControllingTeamIds: new Set(["team-a"]),
        teamStrategies: [stageWinStrategy],
        likelyMassSprint: false,
      }).has("team-a"),
    ).toBe(false);
    expect(
      getRaceObjectiveControllingTeamIds({
        baseControllingTeamIds: new Set(["team-a"]),
        teamStrategies: [mountainStrategy],
        likelyMassSprint: false,
      }).has("team-a"),
    ).toBe(false);
  });

  it("makes a stage-win team control a sprint instead of behaving neutrally", () => {
    const input = createDemoSimulationInput("sprint-littoral", 37);
    const teamId = input.riders[0].teamId;
    const simulateWithObjective = (
      objective: "balanced" | "stage_win",
    ) =>
      simulateRaceStage({
        ...input,
        teamStrategies: [
          {
            teamId,
            ...DEFAULT_RACE_TEAM_STRATEGY,
            objective,
          },
        ],
      });

    expect(simulateWithObjective("stage_win")).not.toEqual(
      simulateWithObjective("balanced"),
    );
  });

  it("keeps the same mountain contender throughout a stage race", () => {
    const input = createDemoSimulationInput("haute-montagne", 41);
    const contender = createRider("kom-contender", "team-a", {
      mountain: 74,
      hills: 72,
      breakaway: 76,
    });
    contender.role = "mountain_classification";
    const challenger = createRider("kom-challenger", "team-a", {
      mountain: 88,
      hills: 84,
      breakaway: 86,
    });
    const leader = createRider("gc-leader", "team-a", {
      mountain: 92,
    });
    leader.role = "leader";
    const strategy = {
      teamId: "team-a",
      ...DEFAULT_RACE_TEAM_STRATEGY,
      objective: "mountain_points" as const,
    };
    const firstStageRiders = assignRaceObjectiveDuties({
      ...input,
      riders: [contender, challenger, leader],
      teamStrategies: [strategy],
    });
    const firstTarget = firstStageRiders.find(
      (rider) => rider.mountainPointsTarget,
    );

    expect(firstTarget?.id).toBe(contender.id);
    expect(firstTarget?.raceDuty).toBe("breakaway_candidate");

    const mountainObjectiveRiderIds =
      getMountainObjectiveRiderIdsByTeam(firstStageRiders);
    const secondStageRiders = assignRaceObjectiveDuties({
      ...input,
      riders: [
        { ...contender, role: "domestique", ratings: {
          ...contender.ratings,
          mountain: 55,
          breakaway: 55,
        } },
        { ...challenger, role: "mountain_classification" },
        leader,
      ],
      mountainObjectiveRiderIds,
      teamStrategies: [strategy],
    });

    expect(
      secondStageRiders.find((rider) => rider.mountainPointsTarget)?.id,
    ).toBe(contender.id);

    const flatInput = createDemoSimulationInput("sprint-littoral", 42);
    const flatStageRiders = assignRaceObjectiveDuties({
      ...flatInput,
      isStageRace: true,
      riders: [contender, challenger, leader],
      mountainObjectiveRiderIds,
      teamStrategies: [strategy],
    });
    const flatStageTarget = flatStageRiders.find(
      (rider) => rider.mountainPointsTarget,
    );

    expect(flatStageTarget?.id).toBe(contender.id);
    expect(flatStageTarget?.raceDuty).toBeUndefined();
  });

  it("sends the mountain contender into the breakaway on a stage with GPM", () => {
    const input = createDemoSimulationInput("haute-montagne", 43);
    const teamId = input.riders[0].teamId;
    const simulation = simulateRaceStage({
      ...input,
      teamStrategies: [
        {
          teamId,
          ...DEFAULT_RACE_TEAM_STRATEGY,
          objective: "mountain_points",
        },
      ],
    });
    const target = simulation.resolvedRiders.find(
      (rider) => rider.teamId === teamId && rider.mountainPointsTarget,
    );

    expect(target).toBeDefined();
    expect(
      getStageAttackParticipants(simulation).some(
        (participant) => participant.riderId === target?.id,
      ),
    ).toBe(true);
    expect(simulation.mountainPoints[target!.id] ?? 0).toBeGreaterThan(0);
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
