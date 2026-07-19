import { describe, expect, it } from "vitest";

import {
  createRadarPoints,
  RIDER_RATING_AXES,
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
});
