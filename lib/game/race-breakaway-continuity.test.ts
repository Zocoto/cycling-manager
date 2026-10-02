import { describe, expect, it } from "vitest";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { getControlledBreakawayGapSeconds } from "./race-dynamics";
import { decideLargeBreakawayStandoff, simulateRaceStage, validateRoadSnapshotGroups } from "./race-simulation";

const tiredEscape = {
  breakawaySize: 11, pelotonSize: 36, completedDistanceKm: 80,
  raceProgress: 80 / 146, gapSeconds: 290,
  breakawayAverageEnergy: 19.7, pelotonAverageEnergy: 56.6,
  chasePressure: 0.58, likelyMassSprint: false, roll: 0,
};

describe("breakaway decisions and clocks", () => {
  it("keeps a tired escape racing with 4:50 in hand, even on the worst roll", () => {
    expect(decideLargeBreakawayStandoff(tiredEscape)).not.toBe("breakaway_gives_up");
  });

  it("requires real chase pressure before an exhausted group concedes a small gap", () => {
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, gapSeconds: 60, chasePressure: 0.2 })).not.toBe("breakaway_gives_up");
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, gapSeconds: 60, chasePressure: 0.9 })).toBe("breakaway_gives_up");
  });

  it("lets capable riders continue instead of following their exhausted companions' decision", () => {
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, gapSeconds: 60, chasePressure: 0.9,
      breakawayRiderEnergies: [42, ...Array(10).fill(2)], breakawayAverageEnergy: 62 / 11,
    })).not.toBe("breakaway_gives_up");
  });

  it("persists the peloton's concession even when a large escape splits into a small one", () => {
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, breakawaySize: 7,
      previousDecision: "peloton_gives_up",
    })).toBe("peloton_gives_up");
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, previousDecision: "peloton_gives_up" })).toBe("peloton_gives_up");
  });

  it("resumes chasing a GC threat, an explicit order or a decisive sprint", () => {
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, mustChase: true, roll: 1,
      previousDecision: "peloton_gives_up",
    })).toBeNull();
  });

  it("keeps an exhausted escape yielding until the conditions actually change", () => {
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, gapSeconds: 40, chasePressure: 0.9,
      previousDecision: "breakaway_gives_up", roll: 1,
    })).toBe("breakaway_gives_up");
    expect(decideLargeBreakawayStandoff({ ...tiredEscape, breakawaySize: 0,
      previousDecision: "peloton_gives_up",
    })).toBeNull();
  });

  it("does not recreate a 5:12 gap from 48 seconds at a segment boundary", () => {
    const context = { previousGapSeconds: 48, naturalGapSeconds: 45,
      targetGapSeconds: 312, chasePressure: 0.58, additionalClosingSeconds: 2 };
    expect(getControlledBreakawayGapSeconds(context)).toBe(48);
    expect(getControlledBreakawayGapSeconds({ ...context, chasePressure: 0.9 })).toBe(43);
    expect(getControlledBreakawayGapSeconds({ ...context, chasePressure: 0.2 })).toBe(48);
    expect(getControlledBreakawayGapSeconds({ ...context, naturalGapSeconds: 52, additionalClosingSeconds: 0 })).toBe(52);
  });

  it("keeps continuous gaps and coherent groups in a large synthetic mountainous field", () => {
    const demo = createDemoSimulationInput("haute-montagne", "large-breakaway-continuity");
    const input = {
      ...demo,
      riders: Array.from({ length: 120 }, (_, index) => ({
        ...demo.riders[index % demo.riders.length],
        id: `synthetic-rider-${String(index).padStart(3, "0")}`,
        name: `Coureur synthétique ${index + 1}`,
        teamId: `synthetic-team-${Math.floor(index / 6)}`,
        teamName: `Équipe synthétique ${Math.floor(index / 6) + 1}`,
      })),
    };
    const simulation = simulateRaceStage(input);
    expect(simulateRaceStage(input)).toEqual(simulation);
    const critical = simulation.timeline.filter((snapshot) => snapshot.completedDistanceKm >= 80 && snapshot.completedDistanceKm <= 100);
    expect(critical).toHaveLength(3);
    expect(critical.flatMap((snapshot) => snapshot.commentary).some((line) => line.includes("accepte d’être reprise"))).toBe(false);
    for (const snapshot of simulation.timeline) {
      const abandoned = new Set(simulation.timeline.filter((entry) => entry.segmentNumber <= snapshot.segmentNumber)
        .flatMap((entry) => entry.abandonments.map((rider) => rider.riderId)));
      validateRoadSnapshotGroups(snapshot.groups, simulation.resolvedRiders.filter((rider) => !abandoned.has(rider.id)).map((rider) => rider.id));
    }
    const frames = simulation.visualTimeline!.filter((frame) => frame.completedDistanceKm >= 80 && frame.completedDistanceKm <= 100);
    for (let index = 1; index < frames.length; index += 1) {
      const previousGap = frames[index - 1].groups.find((group) => group.type === "peloton")?.gapToLeaderSeconds;
      const gap = frames[index].groups.find((group) => group.type === "peloton")?.gapToLeaderSeconds;
      if (previousGap !== undefined && gap !== undefined) {
        expect(Math.abs(gap - previousGap)).toBeLessThan(50);
      }
    }
  });
});
