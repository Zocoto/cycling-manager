import { describe, expect, it } from "vitest";

import {
  summarizeSponsorObjectives,
  summarizeSponsorObjectiveStatuses,
} from "./sponsor-objective-summary";

describe("sponsor objective summary", () => {
  it("calcule la satisfaction avec le poids des objectifs atteints", () => {
    expect(
      summarizeSponsorObjectives([
        { status: "achieved", satisfactionPoints: 18 },
        { status: "in_progress", satisfactionPoints: 14 },
        { status: "achieved", satisfactionPoints: 10 },
        { status: "failed", satisfactionPoints: 8 },
      ]),
    ).toEqual({
      completed: 2,
      total: 4,
      satisfactionScore: 28,
      satisfactionMaximum: 50,
    });
  });

  it("conserve le résumé historique des statuts", () => {
    expect(
      summarizeSponsorObjectiveStatuses([
        "achieved",
        "in_progress",
        "achieved",
        "not_started",
        "failed",
      ]),
    ).toEqual({
      completed: 2,
      total: 5,
      satisfactionScore: 0,
      satisfactionMaximum: 0,
    });
  });

  it("retourne un résumé vide sans objectif", () => {
    expect(summarizeSponsorObjectives([])).toEqual({
      completed: 0,
      total: 0,
      satisfactionScore: 0,
      satisfactionMaximum: 0,
    });
  });
});