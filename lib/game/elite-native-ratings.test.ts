import { describe, expect, it } from "vitest";
import { applyEliteNativeRatingPremium, getEliteNativeRatingPremium } from "./elite-native-ratings";
import type { RiderRatings } from "./rider-profile";

const ratings: RiderRatings = {
  mountain: 70, hills: 70, flat: 70, timeTrial: 70, cobbles: 70, sprint: 70,
  acceleration: 70, downhill: 70, endurance: 70, resistance: 70,
  recovery: 70, breakaway: 70, prologue: 70,
};

describe("elite native rating premium", () => {
  it.each([[74, 75, 1], [85, 86, 1.25], [90, 91, 1.5], [95, 96, 1.75]])(
    "values the native step %s → %s as %s intrinsic points",
    (lower, upper, expected) => {
      const value = (native: number) => native + getEliteNativeRatingPremium(native);
      expect(value(upper) - value(lower)).toBe(expected);
    },
  );

  it("preserves all sub-threshold ratings and contextual bonuses exactly", () => {
    const native = { ...ratings, mountain: 85, sprint: 74 };
    const adjusted = { ...native, mountain: 104, sprint: 95 };
    expect(applyEliteNativeRatingPremium(adjusted, native)).toBe(adjusted);
    for (let native = 0; native <= 85; native++) {
      expect(getEliteNativeRatingPremium(native)).toBe(0);
    }
  });

  it("is continuous at each threshold, monotone, and bounded at the native maximum", () => {
    for (const threshold of [85, 90, 95]) {
      const at = threshold + getEliteNativeRatingPremium(threshold);
      const before = threshold - 1e-6 + getEliteNativeRatingPremium(threshold - 1e-6);
      const after = threshold + 1e-6 + getEliteNativeRatingPremium(threshold + 1e-6);
      expect(at - before).toBeGreaterThan(0);
      expect(after - at).toBeGreaterThan(0);
      expect(after - before).toBeLessThan(4e-6);
    }
    expect(getEliteNativeRatingPremium(100)).toBe(7.5);
    expect(getEliteNativeRatingPremium(120)).toBe(7.5);
  });

  it("uses native ratings separately on every axis without mutating either input", () => {
    const native = { ...ratings, mountain: 86, hills: 91, recovery: 96, timeTrial: 100 };
    const adjusted = { ...native, mountain: 96, hills: 100, recovery: 98, timeTrial: 112 };
    const nativeBefore = { ...native };
    const adjustedBefore = { ...adjusted };
    const result = applyEliteNativeRatingPremium(adjusted, native);
    expect(result).toEqual({ ...adjusted, mountain: 96.25, hills: 101.75, recovery: 102.5, timeTrial: 119.5 });
    expect(native).toEqual(nativeBefore);
    expect(adjusted).toEqual(adjustedBefore);
    expect(result).not.toBe(adjusted);
    // A negative contextual adjustment is preserved, not curved a second time.
    expect(applyEliteNativeRatingPremium({ ...ratings, mountain: 80 }, { ...ratings, mountain: 96 }).mountain)
      .toBe(84.5);
  });
});
