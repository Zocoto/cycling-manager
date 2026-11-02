import { describe, expect, it } from "vitest";
import { getRiderSeasonRaceLoad } from "./rider-race-load";

describe("seasonal race load", () => {
  it("starts in S5 and stays active in subsequent seasons", () => {
    expect(getRiderSeasonRaceLoad(4, 45, 5)).toBeNull();
    expect(getRiderSeasonRaceLoad(5, 0, 0)?.warning).toBeNull();
    expect(getRiderSeasonRaceLoad(6, 31, 0)?.warning).toBe("overloaded");
  });
  it("warns before and after the 30-start threshold", () => {
    expect(getRiderSeasonRaceLoad(5, 24, 0)?.warning).toBeNull();
    expect(getRiderSeasonRaceLoad(5, 25, 0)?.warning).toBe("approaching");
    expect(getRiderSeasonRaceLoad(5, 30, 0)?.warning).toBe("approaching");
    expect(getRiderSeasonRaceLoad(5, 31, 0)?.warning).toBe("overloaded");
    expect(getRiderSeasonRaceLoad(5, 20, 11)).toEqual({ raceDays: 20, projectedRaceDays: 31, warning: "projected" });
  });
  it("does not treat invalid values as raced days", () => {
    expect(getRiderSeasonRaceLoad(NaN, 50, 0)).toBeNull();
    expect(getRiderSeasonRaceLoad(5, NaN, -4)).toEqual({ raceDays: 0, projectedRaceDays: 0, warning: null });
  });
});
