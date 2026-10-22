import { describe, expect, it } from "vitest";
import { getSprintTrainRelayAdjustment, orderSprintTrain, readSprintTrainOrder } from "./sprint-train";
import { createDemoSimulationInput, RACE_DEMO_SCENARIOS } from "./race-simulation-demo";
import { simulateRaceStage, type RiderSimulationInput } from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY, getRiderRaceDuty } from "./race-strategy";

const helpers = [
  { id: "power", ratings: { flat: 90, sprint: 55, acceleration: 60 }, energy: 75 },
  { id: "launch", ratings: { flat: 65, sprint: 90, acceleration: 90 }, energy: 75 },
];
describe("optional ordered sprint train", () => {
  it("places flat power first, explosive leadout last and gives order a bounded effect", () => {
    expect(orderSprintTrain([...helpers].reverse()).map((rider) => rider.id)).toEqual(["power", "launch"]);
    expect(getSprintTrainRelayAdjustment(helpers)).toBeGreaterThan(0);
    expect(getSprintTrainRelayAdjustment([...helpers].reverse())).toBeLessThan(0);
    expect(Math.abs(getSprintTrainRelayAdjustment(helpers))).toBeLessThanOrEqual(3);
  });
  it("keeps the fresher identical rider for the last relay", () => {
    expect(orderSprintTrain([{ ...helpers[1], id: "fresh", energy: 90 }, { ...helpers[1], id: "tired", energy: 25 }]).map((rider) => rider.id))
      .toEqual(["tired", "fresh"]);
  });
  it("supports all teammates without a three-rider limit", () => {
    const team = Array.from({ length: 11 }, (_, index) => ({ ...helpers[index % 2], id: `helper-${index}` }));
    expect(orderSprintTrain(team, team.map((rider) => rider.id).reverse()).map((rider) => rider.id))
      .toEqual(team.map((rider) => rider.id).reverse());
  });
  it("tolerates stale, foreign, duplicate or malformed entries and appends new helpers", () => {
    expect(orderSprintTrain(helpers, ["launch", "missing", "launch", 12, null]).map((rider) => rider.id)).toEqual(["launch", "power"]);
    for (const value of [null, "invalid", {}, 12]) expect(readSprintTrainOrder(value)).toEqual([]);
    expect(orderSprintTrain([], { invalid: true })).toEqual([]);
    expect(getSprintTrainRelayAdjustment([helpers[0]])).toBe(0);
    const order = Object.freeze(["launch", "missing"]);
    orderSprintTrain(Object.freeze([...helpers]), order);
    expect(order).toEqual(["launch", "missing"]);
  });
  it.each(RACE_DEMO_SCENARIOS.map((scenario) => scenario.id))("produces complete results despite obsolete preferences: %s", (scenario) => {
    for (let seed = 1; seed <= 4; seed++) {
      const input = createDemoSimulationInput(scenario, seed);
      const teamId = input.riders[0].teamId;
      const strategy = { teamId, ...DEFAULT_RACE_TEAM_STRATEGY };
      const baseline = simulateRaceStage({ ...input, teamStrategies: [strategy] });
      const result = simulateRaceStage({ ...input, teamStrategies: [{ ...strategy,
        sprintTrainOrder: ["missing", input.riders.find((rider) => rider.teamId !== teamId)!.id, "missing"],
      }] });
      expect(result).toEqual(baseline);
      expect(result.results).toHaveLength(input.riders.length);
      expect(new Set(result.results.map((row) => row.riderId)).size).toBe(input.riders.length);
      expect(result.results.every((row) => Number.isFinite(row.elapsedTimeSeconds))).toBe(true);
    }
  });
  it.each(["haute-montagne", "chrono-algarve"] as const)("does not change mountain / time-trial results: %s", (scenario) => {
    const input = createDemoSimulationInput(scenario, 53);
    const teamId = input.riders[0].teamId;
    const riders = input.riders.map((rider) => ({ ...rider }));
    const teammates = riders.filter((rider) => rider.teamId === teamId && rider.role !== "leader" && rider.role !== "leader_sprinter");
    teammates.slice(0, 4).forEach((rider) => { rider.role = "leadout"; });
    const strategy = { teamId, ...DEFAULT_RACE_TEAM_STRATEGY };
    expect(simulateRaceStage({ ...input, riders, teamStrategies: [{ ...strategy, sprintTrainOrder: teammates.map((rider) => rider.id).reverse() }] }))
      .toEqual(simulateRaceStage({ ...input, riders, teamStrategies: [strategy] }));
  });
  it("allows seven pilots, missions, attacks and a late withdrawal without blocking results", () => {
    const input = createDemoSimulationInput("sprint-littoral", 27);
    const model = input.riders[0];
    const teamId = "large-sprint-team";
    const riders: RiderSimulationInput[] = [
      { ...model, id: "sprinter", teamId, role: "sprinter" },
      ...Array.from({ length: 7 }, (_, index) => ({ ...model, id: `pilot-${index}`, teamId, role: "leadout" as const, form: index === 6 ? 25 : 90 })),
      ...input.riders.filter((rider) => rider.teamId !== model.teamId),
    ];
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId,
      lieutenantRiderId: "pilot-1", dangerPacerRiderId: "pilot-2", breakawayRiderId: "pilot-3",
      sprintTrainOrder: ["pilot-6", "pilot-5", "pilot-4", "pilot-3", "pilot-2", "pilot-1", "pilot-0"],
      attackOrders: [{ riderId: "pilot-4", segmentNumber: input.segments[0].segmentNumber, intensity: "measured" as const, condition: "always" as const }],
    };
    const options = { ...input, riders: riders.map((rider) => ({ ...rider,
      raceDuty: rider.teamId === teamId ? getRiderRaceDuty(strategy, rider.id) : null,
    })), teamStrategies: [strategy], unavailableRiderIds: ["pilot-0"] };
    const result = simulateRaceStage(options);
    expect(result.results).toHaveLength(riders.length - 1);
    expect(result.resolvedRiders.find((rider) => rider.id === "pilot-1")?.raceDuty).toBe("lieutenant");
    expect(result.resolvedRiders.filter((rider) => rider.teamId === teamId && rider.role === "leadout")).toHaveLength(6);
    expect(result.results.every((row) => Number.isFinite(row.elapsedTimeSeconds))).toBe(true);
    expect(simulateRaceStage(options)).toEqual(result);
  });
});
