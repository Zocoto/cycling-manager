import { describe, expect, it } from "vitest";

import {
  getIntermediateSprintVisualProgress,
  getRaceGroupDisplayLabel,
  getRaceGroupRiderSlots,
  getRaceRoadFormationTop,
  getRaceRoadSlopeOffset,
  shouldShowRaceRoadMarkings,
  shouldShowRaceSupportCars,
} from "./race-visual-layout";

describe("race visual layout", () => {
  it("spreads a peloton across several road depths without jitter", () => {
    const riderIds = Array.from({ length: 8 }, (_, index) => `rider-${index}`);
    const firstLayout = getRaceGroupRiderSlots({
      riderIds,
      compact: false,
    });
    const secondLayout = getRaceGroupRiderSlots({
      riderIds,
      compact: false,
    });

    expect(firstLayout).toEqual(secondLayout);
    expect(new Set(firstLayout.map((slot) => slot.offsetY)).size).toBeGreaterThan(3);
    expect(Math.max(...firstLayout.map((slot) => slot.offsetX))).toBeGreaterThan(35);
    expect(Math.min(...firstLayout.map((slot) => slot.offsetX))).toBeLessThan(-55);
  });

  it("reserves support cars for visually uncluttered race situations", () => {
    expect(shouldShowRaceSupportCars(1)).toBe(true);
    expect(shouldShowRaceSupportCars(3)).toBe(true);
    expect(shouldShowRaceSupportCars(4)).toBe(false);
    expect(shouldShowRaceSupportCars(0)).toBe(false);
  });

  it("stretches breakaways into a narrow paceline", () => {
    const slots = getRaceGroupRiderSlots({
      riderIds: Array.from({ length: 8 }, (_, index) => `escape-${index}`),
      compact: false,
      formation: "breakaway-line",
    });

    expect(Math.max(...slots.map((slot) => slot.offsetX))).toBeGreaterThan(55);
    expect(Math.min(...slots.map((slot) => slot.offsetX))).toBeLessThan(-100);
    expect(
      Math.max(...slots.map((slot) => slot.offsetY)) -
        Math.min(...slots.map((slot) => slot.offsetY)),
    ).toBeLessThanOrEqual(3);
  });

  it("places three workers ahead of the peloton bunch", () => {
    const slots = getRaceGroupRiderSlots({
      riderIds: Array.from({ length: 8 }, (_, index) => `peloton-${index}`),
      compact: false,
      formation: "peloton-front",
    });

    expect(slots.slice(0, 3).map((slot) => slot.offsetY)).toEqual([8, 8, 9]);
    expect(
      Math.min(...slots.slice(0, 3).map((slot) => slot.offsetX)),
    ).toBeGreaterThan(
      Math.max(...slots.slice(3).map((slot) => slot.offsetX)),
    );
    expect(
      new Set(slots.slice(3).map((slot) => slot.offsetY)).size,
    ).toBeGreaterThan(3);
  });

  it("opens an intermediate sprint battle only around its line", () => {
    expect(
      getIntermediateSprintVisualProgress({
        primeType: "intermediate_sprint",
        segmentProgress: 0.33,
      }),
    ).toBeNull();
    expect(
      getIntermediateSprintVisualProgress({
        primeType: "intermediate_sprint",
        segmentProgress: 0.49,
      }),
    ).toBeCloseTo(0.5);
    expect(
      getIntermediateSprintVisualProgress({
        primeType: "mountain",
        segmentProgress: 0.49,
      }),
    ).toBeNull();
  });

  it("stops calling a very small main group a peloton", () => {
    expect(
      getRaceGroupDisplayLabel({
        type: "peloton",
        riderCount: 8,
        gapToLeaderSeconds: 42,
        fallbackLabel: "Peloton",
      }),
    ).toBe("Groupe principal");
    expect(
      getRaceGroupDisplayLabel({
        type: "peloton",
        riderCount: 8,
        gapToLeaderSeconds: 0,
        fallbackLabel: "Peloton",
      }),
    ).toBe("Groupe de tête");
    expect(
      getRaceGroupDisplayLabel({
        type: "peloton",
        riderCount: 24,
        gapToLeaderSeconds: 0,
        fallbackLabel: "Peloton",
      }),
    ).toBe("Peloton");
  });
  it("accentue les forts pourcentages sans déformer les pentes ordinaires", () => {
    expect(getRaceRoadSlopeOffset(0)).toBe(0);
    expect(getRaceRoadSlopeOffset(4)).toBe(4);
    expect(getRaceRoadSlopeOffset(9)).toBe(12.5);
    expect(getRaceRoadSlopeOffset(14)).toBe(14);
    expect(getRaceRoadSlopeOffset(-9)).toBe(-12.5);
  });

  it("retire les marquages blancs des secteurs pavés", () => {
    expect(shouldShowRaceRoadMarkings("asphalt")).toBe(true);
    expect(shouldShowRaceRoadMarkings("cobbles")).toBe(false);
  });

  it("keeps rider formations inside the road surface on every slope", () => {
    const uphillTop = getRaceRoadFormationTop({
      roadLeft: 68,
      roadRight: 40,
      roadDepth: 32,
      horizontalPosition: 10,
    });
    const downhillTop = getRaceRoadFormationTop({
      roadLeft: 40,
      roadRight: 68,
      roadDepth: 32,
      horizontalPosition: 84,
    });

    expect(uphillTop).toBeGreaterThan(65);
    expect(uphillTop).toBeLessThan(68);
    expect(downhillTop).toBeGreaterThan(63);
    expect(downhillTop).toBeLessThan(66);
    expect(
      getRaceRoadFormationTop({
        roadLeft: 54,
        roadRight: 54,
        roadDepth: 32,
        horizontalPosition: 150,
      }),
    ).toBeCloseTo(55.92);
  });

  it("keeps special formations compact when many groups are visible", () => {
    const riderIds = Array.from({ length: 8 }, (_, index) => `compact-${index}`);
    const breakaway = getRaceGroupRiderSlots({
      riderIds,
      compact: true,
      formation: "breakaway-line",
    });
    const peloton = getRaceGroupRiderSlots({
      riderIds,
      compact: true,
      formation: "peloton-front",
    });

    expect(breakaway).toHaveLength(5);
    expect(peloton).toHaveLength(5);
    expect(
      Math.max(...breakaway.map((slot) => slot.offsetX)) -
        Math.min(...breakaway.map((slot) => slot.offsetX)),
    ).toBeLessThan(100);
  });
});
