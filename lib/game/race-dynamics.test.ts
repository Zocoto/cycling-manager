import { describe, expect, it } from "vitest";

import {
  evolveBreakawayMomentum,
  getContextualBreakawayGapCeiling,
  getContextualBreakawayMaximum,
  splitRaceSegmentIntoSimulationTicks,
} from "./race-dynamics";

describe("evolveBreakawayMomentum", () => {
  const balancedState = {
    previousMomentum: 0.5,
    raceProgress: 0.5,
    gapSeconds: 220,
    targetGapSeconds: 300,
    breakawaySize: 6,
    pelotonSize: 90,
    breakawayAverageEnergy: 55,
    pelotonAverageEnergy: 55,
    chasePressure: 0.5,
    selectiveTerrainShare: 0.35,
    likelyMassSprint: false,
    randomRoll: 0.5,
  };

  it("renforce progressivement une échappée qui conserve énergie et avance", () => {
    const healthy = evolveBreakawayMomentum({
      ...balancedState,
      gapSeconds: 380,
      breakawayAverageEnergy: 72,
      pelotonAverageEnergy: 42,
      chasePressure: 0.18,
    });
    const threatened = evolveBreakawayMomentum({
      ...balancedState,
      gapSeconds: 65,
      breakawayAverageEnergy: 28,
      pelotonAverageEnergy: 68,
      chasePressure: 0.88,
    });

    expect(healthy).toBeGreaterThan(balancedState.previousMomentum);
    expect(threatened).toBeLessThan(balancedState.previousMomentum);
  });

  it("ne laisse pas un seul tirage décider de l'issue", () => {
    const badRoll = evolveBreakawayMomentum({
      ...balancedState,
      randomRoll: 0,
    });
    const goodRoll = evolveBreakawayMomentum({
      ...balancedState,
      randomRoll: 1,
    });

    expect(goodRoll - badRoll).toBeLessThanOrEqual(0.081);
  });

  it("uses live relay cooperation instead of assuming every group works equally", () => {
    const organized = evolveBreakawayMomentum({
      ...balancedState,
      cooperation: 0.88,
    });
    const fractured = evolveBreakawayMomentum({
      ...balancedState,
      cooperation: 0.18,
    });

    expect(organized).toBeGreaterThan(fractured);
  });
});

describe("contextual breakaway limits", () => {
  it("laisse l'écart respirer quand le peloton renonce", () => {
    const controlled = getContextualBreakawayGapCeiling({
      raceProgress: 0.6,
      breakawaySize: 8,
      pelotonSize: 80,
      chasePressure: 0.8,
      pelotonHasGivenUp: false,
    });
    const uncontested = getContextualBreakawayGapCeiling({
      raceProgress: 0.6,
      breakawaySize: 8,
      pelotonSize: 80,
      chasePressure: 0.1,
      pelotonHasGivenUp: true,
    });

    expect(controlled).toBeGreaterThanOrEqual(360);
    expect(uncontested).toBeGreaterThan(540);
    expect(uncontested).toBeGreaterThan(controlled);
  });

  it("dimensionne l'échappée au peloton sans plafond universel à quatorze", () => {
    expect(
      getContextualBreakawayMaximum({ riderCount: 24, teamCount: 6 }),
    ).toBe(7);
    expect(
      getContextualBreakawayMaximum({ riderCount: 180, teamCount: 22 }),
    ).toBeGreaterThan(14);
  });
});

describe("splitRaceSegmentIntoSimulationTicks", () => {
  it("raffine la physique sans modifier la distance ni dupliquer les primes", () => {
    const prime = {
      type: "intermediate_sprint" as const,
      category: null,
      pointsScale: [10, 6, 4],
    };
    const ticks = splitRaceSegmentIntoSimulationTicks({
      segmentNumber: 4,
      distanceKm: 9,
      terrain: "flat",
      surface: "asphalt",
      averageGradientPct: 0,
      prime,
    });

    expect(ticks).toHaveLength(5);
    expect(ticks.every((tick) => tick.distanceKm <= 2)).toBe(true);
    expect(
      ticks.reduce((total, tick) => total + tick.distanceKm, 0),
    ).toBeCloseTo(9);
    expect(ticks.filter((tick) => tick.prime !== null)).toEqual([
      expect.objectContaining({ prime }),
    ]);
    expect(ticks.every((tick) => tick.segmentNumber === 4)).toBe(true);
  });
});
