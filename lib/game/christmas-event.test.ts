import { describe, expect, it } from "vitest";
import { getChristmasEventPhase, isChristmasEventOpen } from "./christmas-event";

describe("Christmas 2026 opening", () => {
  it("opens exactly at Paris midnight on 1 December", () => {
    expect(getChristmasEventPhase(new Date("2026-11-30T22:59:59.999Z"))).toBe("upcoming");
    expect(isChristmasEventOpen(new Date("2026-11-30T23:00:00Z"))).toBe(true);
  });
  it("includes all 31 December and closes at New Year Paris midnight", () => {
    expect(isChristmasEventOpen(new Date("2026-12-31T22:59:59.999Z"))).toBe(true);
    expect(getChristmasEventPhase(new Date("2026-12-31T23:00:00Z"))).toBe("closed");
  });
  it("never opens future editions or invalid dates by accident", () => {
    expect(isChristmasEventOpen(new Date("2027-12-15T12:00:00Z"))).toBe(false);
    expect(isChristmasEventOpen(new Date("invalid"))).toBe(false);
  });
});
