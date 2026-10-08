import { describe, expect, it } from "vitest";

import {
  getRiderPhysiologyProfileModifier,
  getRiderPhysiologyTerrainModifier,
  type RiderPhysiology,
} from "./rider-physiology";
import type { RiderSimulationRatings } from "./race-simulation";

const climberRatings: RiderSimulationRatings = {
  flat: 58,
  mountain: 78,
  hills: 70,
  cobbles: 48,
  downhill: 64,
  sprint: 50,
  acceleration: 68,
  timeTrial: 58,
  prologue: 55,
  endurance: 72,
  resistance: 68,
  recovery: 70,
  breakaway: 64,
};

const legacyPhysiology: RiderPhysiology = {
  heightCm: 170,
  weightKg: 59,
  baselineWeightKg: 59,
  physiologyVersion: 0,
};

describe("rider physiology", () => {
  it("keeps existing riders neutral at migration weight", () => {
    expect(
      getRiderPhysiologyProfileModifier({
        physiology: legacyPhysiology,
        ratings: climberRatings,
        profileType: "mountain",
      }),
    ).toBe(0);
  });

  it("immediately penalizes excess weight on a long climb", () => {
    const modifier = getRiderPhysiologyTerrainModifier({
      physiology: { ...legacyPhysiology, weightKg: 62 },
      ratings: climberRatings,
      segment: {
        terrain: "climb",
        surface: "asphalt",
        distanceKm: 15,
        averageGradientPct: 8,
      },
    });

    expect(modifier).toBeLessThan(-2);
  });

  it("rewards an effective weight cut in mountain races", () => {
    const sharpened = getRiderPhysiologyProfileModifier({
      physiology: { ...legacyPhysiology, weightKg: 58 },
      ratings: climberRatings,
      profileType: "mountain",
    });

    expect(sharpened).toBeCloseTo(0.62, 5);
  });

  it("gives weight gain below the profile threshold a small cobbled stability benefit", () => {
    const modifier = getRiderPhysiologyTerrainModifier({
      physiology: { ...legacyPhysiology, weightKg: 60 },
      ratings: climberRatings,
      segment: {
        terrain: "flat",
        surface: "cobbles",
        distanceKm: 8,
        averageGradientPct: 1,
      },
    });

    expect(modifier).toBeCloseTo(0.2, 5);
  });
});
