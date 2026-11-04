import { describe, expect, it } from "vitest";

import { isSeasonalCronActive } from "./seasonal-cron";

describe("Paris seasonal cron variants", () => {
  it.each([
    ["2026-01-15T12:00:00Z", false],
    ["2026-07-15T12:00:00Z", true],
    ["2026-03-29T00:59:59Z", false],
    ["2026-03-29T01:00:00Z", true],
    ["2026-10-25T00:59:59Z", true],
    ["2026-10-25T01:00:00Z", false],
  ])("selects the correct variant at %s", (timestamp, summer) => {
    const now = new Date(timestamp);
    expect(isSeasonalCronActive("early-summer-pre-p1", now)).toBe(summer);
    expect(isSeasonalCronActive("early-winter-pre-p1", now)).toBe(!summer);
    expect(isSeasonalCronActive("road-summer", now)).toBe(summer);
    expect(isSeasonalCronActive("time-trial-winter", now)).toBe(!summer);
  });

  it.each(["early", "late-10-p1", "early-recovery", "road-recovery", "time-trial-recovery"])(
    "leaves the unconditional slot %s active in both seasons",
    (slot) => {
      expect(isSeasonalCronActive(slot, new Date("2026-01-15T12:00:00Z"))).toBe(true);
      expect(isSeasonalCronActive(slot, new Date("2026-07-15T12:00:00Z"))).toBe(true);
    },
  );

  it("still gates recovery slots that have an explicit seasonal token", () => {
    expect(isSeasonalCronActive("late-summer-recovery", new Date("2026-01-15T12:00:00Z"))).toBe(false);
    expect(isSeasonalCronActive("late-winter-recovery", new Date("2026-07-15T12:00:00Z"))).toBe(false);
  });
});
