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

  it("interpolates high-frequency frames globally and inside an authored segment", () => {
    const frames = [
      { ...officialTimeline[0], sourceTimelineIndex: 0, completedDistanceKm: 2 },
      { ...officialTimeline[0], sourceTimelineIndex: 0, completedDistanceKm: 4 },
      { ...officialTimeline[1], sourceTimelineIndex: 1, completedDistanceKm: 12 },
      { ...officialTimeline[1], sourceTimelineIndex: 1, completedDistanceKm: 14 },
    ];

    expect(getRaceVisualFrameAtProgress(frames, 0.3)?.completedDistanceKm).toBeCloseTo(3.8);
    expect(
      getRaceVisualFrameForSegment({
        timeline: frames,
        sourceTimelineIndex: 1,
        progress: 0.75,
      })?.completedDistanceKm,
    ).toBeCloseTo(13.5);
  });

  it("stabilise le croisement d'un coureur isolé avec un groupe retardé", () => {
    const leader = {
      id: "peloton",
      label: "Peloton",
      type: "peloton" as const,
      riderIds: ["leader"],
      gapToLeaderSeconds: 0,
      averageEnergy: 70,
    };
    const murrayAt120 = {
      id: "dropped-murray",
      label: "Groupe attardé",
      type: "dropped" as const,
      riderIds: ["murray"],
      gapToLeaderSeconds: 211,
      averageEnergy: 60,
    };
    const delayedAt120 = {
      id: "dropped-delayed-pack",
      label: "Groupe retardé",
      type: "dropped" as const,
      riderIds: ["rider-1", "rider-2"],
      gapToLeaderSeconds: 280,
      averageEnergy: 55,
    };
    const timeline: RaceTimelineSnapshot[] = [
      {
        segmentNumber: 12,
        completedDistanceKm: 120,
        groups: [leader, murrayAt120, delayedAt120],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
      {
        segmentNumber: 13,
        completedDistanceKm: 130,
        groups: [
          leader,
          { ...delayedAt120, gapToLeaderSeconds: 199 },
          { ...murrayAt120, gapToLeaderSeconds: 214 },
        ],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
    ];
    const rawVisualFrame = {
      segmentNumber: 13,
      completedDistanceKm: 122,
      sourceTimelineIndex: 1,
      groups: [
        leader,
        { ...delayedAt120, gapToLeaderSeconds: 267 },
        { ...murrayAt120, gapToLeaderSeconds: 272 },
      ],
    };
    const nearCatchVisualFrame = {
      ...rawVisualFrame,
      completedDistanceKm: 128,
      groups: [
        leader,
        { ...delayedAt120, gapToLeaderSeconds: 223 },
        { ...murrayAt120, gapToLeaderSeconds: 229 },
      ],
    };
    const simulation = buildSimulation({
      timeline,
      visualTimeline: [rawVisualFrame, nearCatchVisualFrame],
    });

    const [stabilized, caught] = getRaceVisualTimeline(simulation);

    expect(
      stabilized.groups.find((group) => group.riderIds.includes("murray"))
        ?.gapToLeaderSeconds,
    ).toBeCloseTo(211.6);
    expect(
      stabilized.groups.find((group) => group.riderIds.includes("rider-1"))
        ?.gapToLeaderSeconds,
    ).toBeCloseTo(263.8);
    expect(stabilized.groups.map((group) => group.id)).toEqual([
      "peloton",
      "dropped-murray",
      "dropped-delayed-pack",
    ]);
    expect(caught.groups).toHaveLength(2);
    expect(caught.groups[1]?.riderIds).toEqual(
      expect.arrayContaining(["murray", "rider-1", "rider-2"]),
    );
    expect(rawVisualFrame.groups[2]?.gapToLeaderSeconds).toBe(272);
  });

  it("interpole un recollage vers un groupe final renommé sans téléportation ni doublon", () => {
    const leaderGroup = {
      id: "peloton",
      label: "Peloton",
      type: "peloton" as const,
      riderIds: ["leader", "stable-front"],
      gapToLeaderSeconds: 0,
      averageEnergy: 70,
    };
    const delayedGroup = {
      id: "dropped-papandreou",
      label: "Groupe retardé",
      type: "dropped" as const,
      riderIds: ["papandreou", "stable-delayed"],
      gapToLeaderSeconds: 19,
      averageEnergy: 52,
    };
    const finalLeaderGroup = {
      id: "finish-group-1",
      label: "Groupe de tête",
      type: "peloton" as const,
      riderIds: ["leader", "stable-front", "papandreou"],
      gapToLeaderSeconds: 0,
      averageEnergy: 57,
    };
    const finalDelayedGroup = {
      id: "finish-group-2",
      label: "Groupe retardé",
      type: "dropped" as const,
      riderIds: ["stable-delayed"],
      gapToLeaderSeconds: 19,
      averageEnergy: 48,
    };
    const timeline: RaceTimelineSnapshot[] = [
      {
        segmentNumber: 14,
        completedDistanceKm: 155,
        groups: [leaderGroup, delayedGroup],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
      {
        segmentNumber: 15,
        completedDistanceKm: 170,
        groups: [finalLeaderGroup, finalDelayedGroup],
        incidents: [],
        abandonments: [],
        commentary: [],
      },
    ];
    const earlyFrame = {
      segmentNumber: 15,
      completedDistanceKm: 158,
      sourceTimelineIndex: 1,
      groups: [leaderGroup, delayedGroup],
    };
    const lateFrame = {
      segmentNumber: 15,
      completedDistanceKm: 167,
      sourceTimelineIndex: 1,
      groups: [leaderGroup, delayedGroup],
    };
    const staleFinishFrame = {
      segmentNumber: 15,
      completedDistanceKm: 170,
      sourceTimelineIndex: 1,
      groups: [leaderGroup, delayedGroup],
    };

    const frames = getRaceVisualTimeline(
      buildSimulation({
        timeline,
        visualTimeline: [earlyFrame, lateFrame, staleFinishFrame],
      }),
    );

    const papandreouEarly = frames[0]?.groups.find((group) =>
      group.riderIds.includes("papandreou"),
    );
    const papandreouLate = frames[1]?.groups.find((group) =>
      group.riderIds.includes("papandreou"),
    );
    expect(papandreouEarly?.type).toBe("chase");
    expect(papandreouEarly?.gapToLeaderSeconds).toBeCloseTo(15.2);
    expect(papandreouLate?.gapToLeaderSeconds).toBeCloseTo(3.8);

    expect(
      frames[0]?.groups.find((group) =>
        group.riderIds.includes("stable-front"),
      )?.gapToLeaderSeconds,
    ).toBe(0);
    expect(
      frames[1]?.groups.find((group) =>
        group.riderIds.includes("stable-delayed"),
      )?.gapToLeaderSeconds,
    ).toBe(19);

    for (const frame of frames) {
      const riderIds = frame.groups.flatMap((group) => group.riderIds);
      expect(new Set(riderIds).size).toBe(riderIds.length);
    }
    expect(frames[2]?.groups).toEqual(timeline[1]?.groups);

    // The normalizer must never rewrite the authored replay or official data.
    expect(earlyFrame.groups[1]?.riderIds).toEqual([
      "papandreou",
      "stable-delayed",
    ]);
    expect(earlyFrame.groups[1]?.gapToLeaderSeconds).toBe(19);
    expect(timeline[1]?.groups[0]?.id).toBe("finish-group-1");
  });

  it("interpolates group gaps and tactical pressure without blending rider identities", () => {
    const frames = [
      {
        segmentNumber: 1,
        completedDistanceKm: 2,
        sourceTimelineIndex: 0,
        groups: [
          {
            id: "breakaway",
            label: "Échappée",
            type: "breakaway" as const,
            riderIds: ["rider-1"],
            gapToLeaderSeconds: 40,
            averageEnergy: 80,
          },
        ],
        frontDynamics: {
          breakawayCooperation: 0.4,
          activeRelayRiderIds: ["rider-1"],
          chasePressure: 0.2,
        },
      },
      {
        segmentNumber: 1,
        completedDistanceKm: 4,
        sourceTimelineIndex: 0,
        groups: [
          {
            id: "breakaway",
            label: "Échappée",
            type: "breakaway" as const,
            riderIds: ["rider-2"],
            gapToLeaderSeconds: 20,
            averageEnergy: 70,
          },
        ],
        frontDynamics: {
          breakawayCooperation: 0.8,
          activeRelayRiderIds: ["rider-2"],
          chasePressure: 0.6,
        },
      },
    ];

    const frame = getRaceVisualFrameAtProgress(frames, 0.25);

    expect(frame?.completedDistanceKm).toBeCloseTo(2.5);
    expect(frame?.groups[0]?.gapToLeaderSeconds).toBeCloseTo(35);
    expect(frame?.groups[0]?.averageEnergy).toBeCloseTo(77.5);
    expect(frame?.groups[0]?.riderIds).toEqual(["rider-1"]);
    expect(frame?.frontDynamics?.chasePressure).toBeCloseTo(0.3);
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
