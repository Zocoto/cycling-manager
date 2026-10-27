import { describe, expect, it } from "vitest";
import { getWeeklyLoginBoosterWeek, normalizeWeeklyLoginBoosterProgress } from "./weekly-login-boosters";

describe("weekly login boosters", () => {
  it.each([[0, 0, 7], [1, 1, 6], [6, 6, 1], [7, 7, 7], [8, 1, 6], [14, 7, 7], [21, 7, 7], [40, 5, 2]])(
    "keeps %i connection days separate from the forty-gift cycle", (days, completedDays, daysUntilNextBooster) => {
      expect(getWeeklyLoginBoosterWeek(days)).toEqual({ completedDays, daysUntilNextBooster });
    },
  );
  it("accepts server progress and rejects incomplete or invalid payloads", () => {
    expect(normalizeWeeklyLoginBoosterProgress({ consecutiveDays: 14, totalBoostersAwarded: 2, boosterAwardedToday: true })).toEqual({ consecutiveDays: 14, totalBoostersAwarded: 2, boosterAwardedToday: true });
    for (const value of [null, {}, { consecutiveDays: -1, totalBoostersAwarded: 2 }, { consecutiveDays: 1.5, totalBoostersAwarded: 0 }]) expect(normalizeWeeklyLoginBoosterProgress(value)).toBeNull();
  });
});
