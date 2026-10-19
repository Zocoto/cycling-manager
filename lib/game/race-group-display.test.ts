import { describe, expect, it } from "vitest";
import { prioritizeOwnRaceGroupRiders } from "./race-group-display";

describe("race group display order", () => {
  it("places own riders first, preserving both relative orders and the frozen snapshot", () => {
    const snapshotIds = Object.freeze(["other-1", "own-2", "other-2", "own-1", "other-3"]);
    expect(prioritizeOwnRaceGroupRiders(snapshotIds, new Set(["own-1", "own-2"])))
      .toEqual(["own-2", "own-1", "other-1", "other-2", "other-3"]);
    expect(snapshotIds).toEqual(["other-1", "own-2", "other-2", "own-1", "other-3"]);
  });
  it("keeps the original order without a viewer or without a teammate in the group", () => {
    const ids = ["other-2", "other-1"];
    expect(prioritizeOwnRaceGroupRiders(ids, new Set())).toBe(ids);
    expect(prioritizeOwnRaceGroupRiders(ids, new Set(["absent"]))).toBe(ids);
    expect(prioritizeOwnRaceGroupRiders([], new Set(["absent"]))).toEqual([]);
  });
  it("does not alphabetize an all-own group", () => {
    const ids = ["own-2", "own-1"];
    expect(prioritizeOwnRaceGroupRiders(ids, new Set(ids))).toBe(ids);
  });
});
