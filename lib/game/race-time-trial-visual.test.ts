import { describe, expect, it } from "vitest";

import {
  buildTimeTrialStartSchedule,
  getTimeTrialSplitIndexes,
  getTimeTrialStartIntervalSeconds,
  getTimeTrialVisualFrame,
} from "./race-time-trial-visual";
import type {
  RiderSimulationInput,
  StageSimulationResult,
} from "./race-simulation";

describe("time trial visual schedule", () => {
  it("starts the general-classification leader last", () => {
    const riders = [rider("leader"), rider("second"), rider("last")];
    const schedule = buildTimeTrialStartSchedule({
      input: {
        stageType: "individual_time_trial",
        riders,
        generalClassification: [
          { riderId: "leader", elapsedTimeSeconds: 100 },
          { riderId: "second", elapsedTimeSeconds: 130 },
          { riderId: "last", elapsedTimeSeconds: 220 },
        ],
      },
      simulation: result(riders),
    });

    expect(schedule.map((starter) => starter.id)).toEqual([
      "last",
      "second",
      "leader",
    ]);
  });

  it("brings starts closer as the field grows", () => {
    expect(getTimeTrialStartIntervalSeconds(18, "individual_time_trial")).toBe(120);
    expect(getTimeTrialStartIntervalSeconds(70, "individual_time_trial")).toBe(60);
    expect(getTimeTrialStartIntervalSeconds(130, "individual_time_trial")).toBe(45);
  });

  it("shows an empty road initially and allows pacing curves to converge at the finish", () => {
    const schedule = buildTimeTrialStartSchedule({
      input: {
        stageType: "individual_time_trial",
        riders: [rider("a"), rider("b")],
      },
      simulation: result([rider("a"), rider("b")]),
    });

    expect(getTimeTrialVisualFrame(schedule, 0).active).toEqual([]);
    const middle = getTimeTrialVisualFrame(schedule, 0.5);
    expect(middle.active.length + middle.finished.length).toBeGreaterThan(0);
    expect(getTimeTrialVisualFrame(schedule, 1).finished).toHaveLength(2);
  });

  it("keeps three readable split points on long courses", () => {
    expect(getTimeTrialSplitIndexes(9)).toEqual([2, 5, 8]);
    expect(getTimeTrialSplitIndexes(2)).toEqual([0, 1]);
  });
});

function rider(id: string): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: `Team ${id}`,
    teamPrimaryColor: "#123456",
    teamSecondaryColor: "#FFFFFF",
    age: 25,
    form: 80,
    role: "leader",
    ratings: {
      flat: 70,
      mountain: 70,
      hills: 70,
      cobbles: 70,
      downhill: 70,
      sprint: 70,
      acceleration: 70,
      timeTrial: 70,
      prologue: 70,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 70,
    },
  };
}

function result(riders: RiderSimulationInput[]): Pick<StageSimulationResult, "results"> {
  return {
    results: riders.map((candidate, index) => ({
      riderId: candidate.id,
      rank: index + 1,
      status: "finished",
      elapsedTimeSeconds: 1_000 + index * 20,
      gapToWinnerSeconds: index * 20,
      energyAfter: 50,
      injury: null,
      abandonment: null,
    })),
  };
}
