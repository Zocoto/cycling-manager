import { describe, expect, it } from "vitest";

import {
  createRadarPoints,
  getRiderSportingProfile,
  RIDER_RATING_AXES,
  type RiderRatings,
  serializeRadarPoints,
} from "./rider-profile";

describe("rider profile radar", () => {
  it("keeps coherent rider ratings next to each other", () => {
    expect(RIDER_RATING_AXES.slice(0, 3).map((axis) => axis.shortLabel)).toEqual([
      "MON",
      "VAL",
      "REC",
    ]);
  });

  it("clamps values and starts at the top of the radar", () => {
    const points = createRadarPoints({
      values: [120, 50, -10],
      center: 100,
      radius: 80,
    });

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[2]).toEqual({ x: 100, y: 100 });
  });

  it("serializes stable SVG polygon coordinates", () => {
    expect(
      serializeRadarPoints([
        { x: 10.123, y: 20.126 },
        { x: 30, y: 40 },
      ])
    ).toBe("10.12,20.13 30,40");
  });

  it("updates the sporting profile when the current ratings evolve", () => {
    const breakawayRider = createRatings({
      breakaway: 66,
      endurance: 62,
      cobbles: 54,
      resistance: 59,
    });

    expect(getRiderSportingProfile(breakawayRider)).toBe("Baroudeur");
    expect(
      getRiderSportingProfile({
        ...breakawayRider,
        cobbles: 68,
        resistance: 64,
      })
    ).toBe("Spécialiste des pavés");
  });
});

function createRatings(overrides: Partial<RiderRatings>): RiderRatings {
  return {
    mountain: 50,
    hills: 50,
    recovery: 55,
    endurance: 55,
    resistance: 55,
    breakaway: 50,
    downhill: 55,
    acceleration: 55,
    sprint: 50,
    flat: 55,
    cobbles: 50,
    prologue: 50,
    timeTrial: 50,
    ...overrides,
  };
}
