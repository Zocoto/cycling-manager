import { describe, expect, it } from "vitest";

import {
  getRaceGroupRiderSlots,
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
});
