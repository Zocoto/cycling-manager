import { describe, expect, it } from "vitest";

import type {
  RaceTimelineSnapshot,
  StageSimulationResult,
} from "@/lib/game/race-simulation";
import {
  applyRaceVisualFrame,
  getRaceVisualFrameAtProgress,
  getRaceVisualFrameForSegment,
  getRaceVisualTimeline,
} from "@/lib/game/race-live-visual";

const officialTimeline: RaceTimelineSnapshot[] = [
  {
    segmentNumber: 1,
    completedDistanceKm: 10,
    groups: [],
    incidents: [],
    abandonments: [],
    commentary: ["Départ"],
  },
  {
    segmentNumber: 2,
    completedDistanceKm: 20,
    groups: [],
    incidents: [],
    abandonments: [],
    commentary: ["Arrivée"],
  },
];

function buildSimulation(
  overrides: Partial<StageSimulationResult> = {},
): StageSimulationResult {
  return {
    stageId: "stage-1",
    seed: "seed",
    resolvedRiders: [],
    timeline: officialTimeline,
    results: [],
    primes: [],
    mountainPoints: {},
    sprintPoints: {},
    ...overrides,
  };
}

describe("race live visual timeline", () => {
  it("falls back to official snapshots for simulations saved before visual frames", () => {
    const frames = getRaceVisualTimeline(buildSimulation());

    expect(frames).toHaveLength(2);
    expect(frames.map((frame) => frame.sourceTimelineIndex)).toEqual([0, 1]);
    expect(frames.map((frame) => frame.completedDistanceKm)).toEqual([10, 20]);
  });

  it("selects high-frequency frames globally and inside an authored segment", () => {
    const frames = [
      { ...officialTimeline[0], sourceTimelineIndex: 0, completedDistanceKm: 2 },
      { ...officialTimeline[0], sourceTimelineIndex: 0, completedDistanceKm: 4 },
      { ...officialTimeline[1], sourceTimelineIndex: 1, completedDistanceKm: 12 },
      { ...officialTimeline[1], sourceTimelineIndex: 1, completedDistanceKm: 14 },
    ];

    expect(getRaceVisualFrameAtProgress(frames, 0.3)?.completedDistanceKm).toBe(4);
    expect(
      getRaceVisualFrameForSegment({
        timeline: frames,
        sourceTimelineIndex: 1,
        progress: 0.75,
      })?.completedDistanceKm,
    ).toBe(14);
  });

  it("updates only visual fields and preserves official commentary and incidents", () => {
    const incident = {
      id: "incident-1",
      type: "puncture" as const,
      riderIds: ["rider-1"],
      abandonedRiderIds: [],
      label: "Crevaison",
    };
    const snapshot = { ...officialTimeline[0], incidents: [incident] };
    const visual = applyRaceVisualFrame(snapshot, {
      segmentNumber: 1,
      completedDistanceKm: 6,
      groups: [
        {
          id: "peloton",
          label: "Peloton",
          type: "peloton",
          riderIds: ["rider-1"],
          gapToLeaderSeconds: 0,
          averageEnergy: 70,
        },
      ],
      sourceTimelineIndex: 0,
    });

    expect(visual.completedDistanceKm).toBe(6);
    expect(visual.groups[0]?.riderIds).toEqual(["rider-1"]);
    expect(visual.commentary).toEqual(["Départ"]);
    expect(visual.incidents).toEqual([incident]);
  });
});
