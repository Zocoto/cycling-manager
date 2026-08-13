import { describe, expect, it } from "vitest";

import {
  buildTimeTrialStartSchedule,
  getTimeTrialSplitIndexes,
  getTimeTrialSplitStandings,
  getTimeTrialStartIntervalSeconds,
  getTimeTrialVisualFrame,
  selectSpacedTimeTrialUnits,
} from "./race-time-trial-visual";
import type {
  RiderSimulationInput,
  RaceTimelineSnapshot,
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
    expect(getTimeTrialStartIntervalSeconds(18, "individual_time_trial")).toBe(180);
    expect(getTimeTrialStartIntervalSeconds(70, "individual_time_trial")).toBe(90);
    expect(getTimeTrialStartIntervalSeconds(130, "individual_time_trial")).toBe(60);
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

  it("places a rider on the intermediate line at the recorded split time", () => {
    const schedule = [
      {
        id: "rider",
        label: "Coureur",
        riderIds: ["rider"],
        startOrder: 1,
        startSeconds: 0,
        elapsedTimeSeconds: 1_000,
        pacingBias: 0.14,
      },
    ];
    const timeline: RaceTimelineSnapshot[] = [
      {
        segmentNumber: 1,
        completedDistanceKm: 20,
        groups: [
          {
            id: "chrono-rider-1",
            label: "Coureur",
            type: "time_trial",
            riderIds: ["rider"],
            gapToLeaderSeconds: 0,
            elapsedTimeSeconds: 500,
            averageEnergy: 80,
          },
        ],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
      {
        segmentNumber: 2,
        completedDistanceKm: 40,
        groups: [
          {
            id: "chrono-rider-2",
            label: "Coureur",
            type: "time_trial",
            riderIds: ["rider"],
            gapToLeaderSeconds: 0,
            elapsedTimeSeconds: 1_000,
            averageEnergy: 60,
          },
        ],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
    ];

    const frame = getTimeTrialVisualFrame(schedule, 0.5, timeline);
    expect(frame.active[0]?.progress).toBe(0.5);
  });

  it("keeps individual riders in one visually spaced line", () => {
    const units = [
      visualUnit("leader", 0.92),
      visualUnit("too-close", 0.86),
      visualUnit("chaser", 0.76),
      visualUnit("starter", 0.6),
    ];

    expect(
      selectSpacedTimeTrialUnits(units).map((unit) => unit.id),
    ).toEqual(["leader", "chaser", "starter"]);
  });

  it("updates a split ranking only when each rider crosses the timing line", () => {
    const schedule = [
      {
        id: "early",
        label: "Premier parti",
        riderIds: ["early"],
        startOrder: 1,
        startSeconds: 0,
        elapsedTimeSeconds: 1_000,
        pacingBias: 0,
      },
      {
        id: "fast",
        label: "Favori tardif",
        riderIds: ["fast"],
        startOrder: 2,
        startSeconds: 120,
        elapsedTimeSeconds: 900,
        pacingBias: 0,
      },
    ];
    const snapshot: RaceTimelineSnapshot = {
      segmentNumber: 2,
      completedDistanceKm: 20,
      groups: [
        {
          id: "chrono-early",
          label: "Premier parti",
          type: "time_trial",
          riderIds: ["early"],
          gapToLeaderSeconds: 50,
          elapsedTimeSeconds: 500,
          averageEnergy: 70,
        },
        {
          id: "chrono-fast",
          label: "Favori tardif",
          type: "time_trial",
          riderIds: ["fast"],
          gapToLeaderSeconds: 0,
          elapsedTimeSeconds: 450,
          averageEnergy: 72,
        },
      ],
      incidents: [],
      abandonments: [],
      commentary: [],
    };

    expect(
      getTimeTrialSplitStandings({
        schedule,
        snapshot,
        raceElapsedSeconds: 550,
        courseDistanceKm: 40,
      }).map((standing) => standing.id),
    ).toEqual(["early"]);

    const updated = getTimeTrialSplitStandings({
      schedule,
      snapshot,
      raceElapsedSeconds: 570,
      courseDistanceKm: 40,
    });
    expect(updated.map((standing) => standing.id)).toEqual(["fast", "early"]);
    expect(updated.map((standing) => standing.gapToLeaderSeconds)).toEqual([
      0,
      50,
    ]);
  });

  it("keeps the live board to a top 20 while preserving every recorded passage", () => {
    const schedule = Array.from({ length: 25 }, (_, index) => ({
      id: `rider-${index}`,
      label: `Coureur ${index}`,
      riderIds: [`rider-${index}`],
      startOrder: index + 1,
      startSeconds: 0,
      elapsedTimeSeconds: 1_000 + index,
      pacingBias: 0,
    }));
    const snapshot: RaceTimelineSnapshot = {
      segmentNumber: 1,
      completedDistanceKm: 20,
      groups: schedule.map((unit, index) => ({
        id: `chrono-${unit.id}`,
        label: unit.label,
        type: "time_trial",
        riderIds: unit.riderIds,
        gapToLeaderSeconds: index,
        elapsedTimeSeconds: 400 + index,
        averageEnergy: 70,
      })),
      incidents: [],
      abandonments: [],
      commentary: [],
    };
    const context = {
      schedule,
      snapshot,
      raceElapsedSeconds: 1_000,
      courseDistanceKm: 40,
    };

    expect(getTimeTrialSplitStandings(context)).toHaveLength(20);
    expect(
      getTimeTrialSplitStandings({ ...context, limit: schedule.length }),
    ).toHaveLength(25);
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

function visualUnit(id: string, progress: number) {
  return {
    id,
    label: id,
    riderIds: [id],
    startOrder: 1,
    startSeconds: 0,
    elapsedTimeSeconds: 1_000,
    pacingBias: 0,
    rawProgress: progress,
    progress,
  };
}
