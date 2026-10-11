import { describe, expect, it } from "vitest";
import { formatSponsorPartialAchievement, readSponsorPartialAchievements } from "./sponsor-partial-achievements";

describe("sponsor partial achievement explanations", () => {
  it("reads official facts and filters malformed, unknown and duplicated facts", () => {
    expect(readSponsorPartialAchievements([
      { code: "stage_win", rank: 1, count: 2 },
      { code: "stage_win", rank: 1, count: 2 },
      { code: "combativity_race", rank: 1, count: 1 },
      { code: "invented", rank: 1, count: 1 },
      { code: "stage_podium", rank: 0, count: 1 },
      { code: "stage_top5", rank: "4", count: 1 },
      { code: "stage_top10", rank: 10, count: -1 }, null,
    ])).toEqual([
      { code: "stage_win", rank: 1, count: 2 }, { code: "combativity_race", rank: 1, count: 1 },
    ]);
    expect(readSponsorPartialAchievements(undefined)).toEqual([]);
    expect(readSponsorPartialAchievements({})).toEqual([]);
  });

  it.each([
    ["near_target", 3, 1, "Classement proche de la cible (3e)"],
    ["stage_win", 1, 1, "1 victoire d’étape"],
    ["stage_win", 1, 2, "2 victoires d’étape"],
    ["stage_podium", 2, 2, "2 podiums d’étape"],
    ["stage_top5", 4, 1, "1 top 5 d’étape"],
    ["stage_top10", 7, 2, "2 top 10 d’étape"],
    ["mountain_classification", 1, 1, "1er du classement de la montagne"],
    ["sprint_classification", 2, 1, "2e du classement par points"],
    ["youth_classification", 3, 1, "3e du classement des jeunes"],
    ["team_classification", 1, 1, "1er du classement par équipes"],
    ["combativity_stage", 1, 2, "2 prix du combatif"],
    ["combativity_race", 1, 1, "Super-combatif du tour"],
  ] as const)("explains %s in French", (code, rank, count, label) => {
    expect(formatSponsorPartialAchievement({ code, rank, count })).toBe(label);
  });
});
