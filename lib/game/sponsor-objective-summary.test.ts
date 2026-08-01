import { describe, expect, it } from "vitest";

import { summarizeSponsorObjectiveStatuses } from "./sponsor-objective-summary";

describe("sponsor objective summary", () => {
  it("counts achieved objectives against every tracked objective", () => {
    expect(
      summarizeSponsorObjectiveStatuses([
        "achieved",
        "in_progress",
        "achieved",
        "not_started",
        "failed",
        "in_progress",
        "not_started",
      ]),
    ).toEqual({ completed: 2, total: 7 });
  });

  it("returns an empty summary when the contract has no objective", () => {
    expect(summarizeSponsorObjectiveStatuses([])).toEqual({
      completed: 0,
      total: 0,
    });
  });
});
