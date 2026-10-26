import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { RaceStageSegment } from "./race-profiles";
import { createDemoSimulationInput } from "./race-simulation-demo";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";
import {
  applyChronologicalRoadFinishEffort,
  buildPreservedRoadGroupFinishTimes,
  getCobblesFinishBaseScore,
  getFlatSprintFinishBaseScore,
  getReducedSprintFinishBaseScore,
  getRoadFinishMode,
  isFlatRunInGroupSprint,
  simulateRaceStage,
  type RiderSimulationInput,
  type StageSimulationInput,
} from "./race-simulation";

const flat = (segmentNumber: number, distanceKm = 18): RaceStageSegment => ({
  segmentNumber, distanceKm, terrain: "flat", surface: "asphalt", averageGradientPct: 0, prime: null,
});
const course = {
  cobbles: [
    { ...flat(1, 21), surface: "cobbles" as const },
    flat(2),
  ],
  hilly: [
    { ...flat(1, 6), terrain: "climb" as const, averageGradientPct: 6 },
    flat(2),
  ],
  mountain: [
    { ...flat(1, 12), terrain: "climb" as const, averageGradientPct: 8 },
    flat(2),
  ],
} satisfies Record<string, RaceStageSegment[]>;

function rider(sprint = 75): RiderSimulationInput {
  return {
    id: "sprinter", name: "Test Sprinter", teamId: "team", teamName: "Test Team",
    teamPrimaryColor: "#123456", teamSecondaryColor: "#FFFFFF", age: 25, form: 90,
    role: "leader_sprinter",
    ratings: {
      mountain: 60, hills: 60, flat: 60, timeTrial: 60, cobbles: 60,
      sprint, acceleration: 60, downhill: 60, endurance: 60, resistance: 60,
      recovery: 60, breakaway: 60, prologue: 60,
    },
  };
}

function score(candidate: RiderSimulationInput, energy: number, segments = course.cobbles) {
  return getReducedSprintFinishBaseScore({ rider: candidate, segments, energy });
}

describe("flat finish: sprint and freshness are the only base ratings", () => {
  it.each([0, 50, 100])("uses 70 percent sprint and 30 percent remaining energy at %i energy", energy => {
    expect(getFlatSprintFinishBaseScore({ rider: rider(75), energy })).toBe(52.5 + energy * 0.3);
  });

  it.each([[-20, 52.5], [120, 82.5]])("clamps energy %i to the physical reserve range", (energy, expected) => {
    expect(getFlatSprintFinishBaseScore({ rider: rider(75), energy })).toBe(expected);
  });

  it("allows a fresher rider to beat a moderately stronger but tired sprinter", () => {
    const tiredStronger = getFlatSprintFinishBaseScore({ rider: rider(80), energy: 50 });
    const freshRival = getFlatSprintFinishBaseScore({ rider: rider(70), energy: 90 });
    expect(tiredStronger).toBe(71);
    expect(freshRival).toBe(76);
    expect(freshRival).toBeGreaterThan(tiredStronger);
  });

  it("retains the sprint specialist's advantage at equal freshness", () => {
    expect(getFlatSprintFinishBaseScore({ rider: rider(80), energy: 60 }))
      .toBeGreaterThan(getFlatSprintFinishBaseScore({ rider: rider(70), energy: 60 }));
  });

  it.each(["mountain", "hills", "flat", "timeTrial", "cobbles", "acceleration", "downhill",
    "endurance", "resistance", "recovery", "breakaway", "prologue"] as const)(
    "does not count %s a second time after the road selection has already happened",
    stat => {
      const low = rider();
      const high = rider();
      low.ratings[stat] = 1;
      high.ratings[stat] = 100;
      expect(score(high, 65)).toBe(score(low, 65));
    },
  );

  it("rewards a higher sprint rating when freshness is equal", () => {
    expect(score(rider(85), 60)).toBeGreaterThan(score(rider(65), 60));
  });

  it("rewards a fresher rider when sprint is equal", () => {
    expect(score(rider(75), 80)).toBeGreaterThan(score(rider(75), 30));
  });

  it("does not vary the finish base because the earlier road was cobbled, hilly or mountainous", () => {
    const candidate = rider();
    const scores = Object.values(course).map(segments => score(candidate, 65, segments));
    expect(new Set(scores).size).toBe(1);
  });

  it.each(["rolling", "attritional", "hilly"] as const)(
    "keeps the legacy %s cobbles helper consistent with the flat sprint formula",
    archetype => {
      const candidate = rider(80);
      const terrainSpecialist = {
        ...candidate,
        ratings: { ...candidate.ratings, cobbles: 100, hills: 100, flat: 100, acceleration: 100 },
      };
      for (const entry of [candidate, terrainSpecialist]) {
        expect(getCobblesFinishBaseScore({
          rider: entry, segments: course.cobbles, energy: 50,
          finishMode: "reduced_sprint", archetype,
        })).toBe(71);
      }
    },
  );

  it("keeps form separate from actual remaining energy instead of applying it twice", () => {
    const lowForm = { ...rider(), form: 20 };
    const highForm = { ...rider(), form: 100 };
    expect(score(lowForm, 65)).toBe(score(highForm, 65));
  });
});

describe("flat finish recognition after selective terrain", () => {
  it.each(Object.entries(course).flatMap(([profile, segments]) =>
    [2, 10, 18].map(groupSize => ({ profile, segments, groupSize }))))(
    "uses a reduced sprint for $groupSize riders after $profile",
    ({ segments, groupSize }) => {
      expect(getRoadFinishMode(segments, groupSize)).toBe("reduced_sprint");
    },
  );

  it("does not turn an uphill arrival into a sprint", () => {
    expect(getRoadFinishMode([flat(1), {
      ...flat(2, 7), terrain: "climb", averageGradientPct: 8,
    }], 18)).toBe("selective");
  });

  it("does not turn a downhill arrival into a flat sprint", () => {
    expect(getRoadFinishMode([flat(1), {
      ...flat(2, 10), terrain: "descent", averageGradientPct: -6,
    }], 18)).toBe("selective");
  });

  it("also uses sprint and freshness for a flat cobbled finish", () => {
    expect(getRoadFinishMode([flat(1), {
      ...flat(2, 20), surface: "cobbles",
    }], 18)).toBe("reduced_sprint");
  });

  it("keeps an uphill cobbled arrival selective", () => {
    expect(getRoadFinishMode([flat(1), {
      ...flat(2, 7), surface: "cobbles", terrain: "climb", averageGradientPct: 8,
    }], 18)).toBe("selective");
  });

  it("does not extend group sprint crash activation to two-rider duels", () => {
    expect(getRoadFinishMode(course.cobbles, 2)).toBe("reduced_sprint");
    expect(isFlatRunInGroupSprint(course.cobbles, 2)).toBe(false);
    expect(isFlatRunInGroupSprint(course.cobbles, 10)).toBe(true);
  });

  it("does not manufacture a group sprint for a lone escapee", () => {
    expect(getRoadFinishMode(course.cobbles, 1)).toBe("selective");
  });
});

describe("flat sprint chronology remains scoped to physical road groups", () => {
  it.each([0, 0.37])("preserves distinct physical groups at identical clocks and snapshot gap %s without added effort", gap => {
    const ranked = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "rear-strong", elapsedTimeSeconds: 100, score: 100 },
        { riderId: "front-weak", elapsedTimeSeconds: 100, score: 10 },
        { riderId: "rear-weak", elapsedTimeSeconds: 100, score: 80 },
        { riderId: "front-strong", elapsedTimeSeconds: 100, score: 40 },
      ],
      groups: [
        { riderIds: ["front-weak", "front-strong"], gapToLeaderSeconds: 0 },
        { riderIds: ["rear-weak", "rear-strong"], gapToLeaderSeconds: gap },
      ],
      effortGapSecondsByRiderId: new Map(),
    });
    expect(ranked.map(row => row.riderId)).toEqual(["front-strong", "front-weak", "rear-strong", "rear-weak"]);
    expect(ranked.every(row => row.elapsedTimeSeconds === 100)).toBe(true);
  });

  it("uses snapshot gap order rather than input array order for equal-clock groups", () => {
    const ranked = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "rear", elapsedTimeSeconds: 100, score: 100 },
        { riderId: "front", elapsedTimeSeconds: 100, score: 10 },
      ],
      groups: [
        { riderIds: ["rear"], gapToLeaderSeconds: 0.5 },
        { riderIds: ["front"], gapToLeaderSeconds: 0 },
      ],
      effortGapSecondsByRiderId: new Map(),
    });
    expect(ranked.map(row => row.riderId)).toEqual(["front", "rear"]);
  });

  it.each([0.1, 0.37, 3, 20])(
    "does not let a stronger sprinter erase an already-earned %.2f second road gap",
    gap => {
      const frontScore = score(rider(45), 30);
      const rearScore = score(rider(95), 95);
      const groups = [
        { type: "breakaway" as const, riderIds: ["front"], gapToLeaderSeconds: 0 },
        { type: "peloton" as const, riderIds: ["rear"], gapToLeaderSeconds: gap },
      ];
      const elapsedTimeByRiderId = new Map([["front", 100], ["rear", 100 + gap]]);
      const times = buildPreservedRoadGroupFinishTimes({ groups, elapsedTimeByRiderId, preserveAllGroups: true });
      const results = [
        { riderId: "rear", elapsedTimeSeconds: times.get("rear")!, score: rearScore },
        { riderId: "front", elapsedTimeSeconds: times.get("front")!, score: frontScore },
      ];
      const ranked = applyChronologicalRoadFinishEffort({
        groups, results, effortGapSecondsByRiderId: new Map(),
      });
      expect(ranked.map(row => row.riderId)).toEqual(["front", "rear"]);
      expect(ranked[0].elapsedTimeSeconds).toBeLessThan(ranked[1].elapsedTimeSeconds);
    },
  );

  it("uses sprint and freshness to order riders only inside the same compact group", () => {
    const results = [
      { riderId: "weaker", elapsedTimeSeconds: 100, score: score(rider(60), 50) },
      { riderId: "stronger", elapsedTimeSeconds: 100, score: score(rider(85), 50) },
      { riderId: "rear", elapsedTimeSeconds: 120, score: score(rider(100), 100) },
    ];
    const ranked = applyChronologicalRoadFinishEffort({
      groups: [
        { riderIds: ["weaker", "stronger"], gapToLeaderSeconds: 0 },
        { riderIds: ["rear"], gapToLeaderSeconds: 20 },
      ],
      results,
      effortGapSecondsByRiderId: new Map(),
    });
    expect(ranked.map(row => row.riderId)).toEqual(["stronger", "weaker", "rear"]);
    expect(ranked.map(row => row.elapsedTimeSeconds)).toEqual([100, 100, 120]);
  });
});

// Independent v51 baselines already recorded by urban-cobbles-regression.
// Flat-finish rebalancing must not change time trials or uphill arrivals.
function fingerprint(input: StageSimulationInput) {
  const simulation = simulateRaceStage(input);
  return createHash("sha256").update(JSON.stringify({
    results: simulation.results,
    timeline: simulation.timeline,
    visualTimeline: simulation.visualTimeline,
    primes: simulation.primes,
    mountainPoints: simulation.mountainPoints,
    sprintPoints: simulation.sprintPoints,
    teamWork: simulation.teamWork,
  })).digest("hex");
}

describe("flat sprint change leaves unrelated sporting outputs intact", () => {
  it("preserves the individual time trial exactly", () => {
    expect(fingerprint(createDemoSimulationInput("chrono-algarve", 41)))
      .toBe("b79ea31a29f267fd184cd161e3bd49c659f9db6b44e6167f42e40b36be04431d");
  });

  it.each([
    ["prologue", "0e56603ad05240c2dcbe61fab2a512083b7ae467399589d811743a62b5929bff"],
    ["team_time_trial", "f513c81d5ceaf1ca9123334f95f46629e6182e0c0eb7eb5f3f2b4051e8030b3e"],
  ] as const)("preserves %s exactly", (stageType, expected) => {
    const base = createDemoSimulationInput("chrono-algarve", 41);
    const input: StageSimulationInput = {
      ...base,
      stageType,
      segments: stageType === "prologue" ? [flat(1, 7)] : base.segments,
      timeTrialPlans: Object.fromEntries(base.riders.map((candidate, index): [string, TimeTrialRiderPlan] => [candidate.id, {
        effortMode: index % 3 === 0 ? "all_in" : index % 3 === 1 ? "conserve" : "normal",
        relaySharePct: stageType === "team_time_trial"
          ? 100 / base.riders.filter(teammate => teammate.teamId === candidate.teamId).length
          : null,
      }])),
    };
    expect(fingerprint(input)).toBe(expected);
  });

  it("preserves the selective uphill arrival with DS role priority", () => {
    const base = createDemoSimulationInput("sprint-littoral", 41);
    const input: StageSimulationInput = {
      ...base,
      profileType: "hilly",
      segments: base.segments.map((segment, index): RaceStageSegment => index === base.segments.length - 1
        ? { ...segment, terrain: "climb", averageGradientPct: 7 }
        : segment),
    };
    // v53 removes the implicit favorite protection of a designated support rider.
    // Restoring only that old protection reproduces the previous v51 fingerprint.
    expect(fingerprint(input)).toBe("788e73ee1ccfc67a6577319623ff82cfe364730b58b2fb920773a3e82def2712");
  });
});
