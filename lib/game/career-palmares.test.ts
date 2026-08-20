import { describe, expect, it } from "vitest";

import {
  buildCareerPalmares,
  type CareerPalmaresEntry,
} from "@/lib/game/career-palmares";

function entry(
  overrides: Partial<CareerPalmaresEntry> = {},
): CareerPalmaresEntry {
  return {
    resultId: "result-1",
    raceKey: "tour-de-france",
    raceName: "Tour de France",
    seasonId: "season-6",
    seasonName: "Saison 6",
    gameYear: 6,
    rank: 1,
    categoryCode: "elite",
    competitionType: "standard",
    prestigeRank: 1,
    isGrandTour: true,
    isMonument: false,
    isJunior: false,
    ...overrides,
  };
}

describe("buildCareerPalmares", () => {
  it("regroupe une même place sur une course et trie les saisons", () => {
    const palmares = buildCareerPalmares([
      entry(),
      entry({
        resultId: "result-3",
        seasonId: "season-16",
        seasonName: "Saison 16",
        gameYear: 16,
      }),
      entry({
        resultId: "result-2",
        seasonId: "season-10",
        seasonName: "Saison 10",
        gameYear: 10,
      }),
    ]);

    expect(palmares.victoryCount).toBe(3);
    expect(palmares.podiumCount).toBe(3);
    expect(palmares.sections[0]).toEqual({
      category: "grand_tour_monument",
      achievements: [
        expect.objectContaining({
          raceName: "Tour de France",
          rank: 1,
          count: 3,
          seasonLabels: ["S6", "S10", "S16"],
        }),
      ],
    });
  });

  it("respecte la hiérarchie demandée et ignore les résultats hors podium", () => {
    const palmares = buildCareerPalmares([
      entry({ isGrandTour: false, isMonument: true }),
      entry({
        resultId: "elite",
        raceKey: "elite",
        raceName: "Elite",
        isGrandTour: false,
        categoryCode: "elite",
      }),
      entry({
        resultId: "world",
        raceKey: "world",
        raceName: "Mondial",
        isGrandTour: false,
        categoryCode: "world",
      }),
      entry({
        resultId: "continental",
        raceKey: "continental",
        raceName: "Continental",
        isGrandTour: false,
        categoryCode: "continental",
      }),
      entry({
        resultId: "national",
        raceKey: "national",
        raceName: "National",
        isGrandTour: false,
        categoryCode: "national",
      }),
      entry({
        resultId: "regional",
        raceKey: "regional",
        raceName: "Régional",
        isGrandTour: false,
        categoryCode: "regional",
      }),
      entry({
        resultId: "junior",
        raceKey: "junior",
        raceName: "Junior",
        isGrandTour: false,
        isJunior: true,
      }),
      entry({ resultId: "fourth", rank: 4 }),
    ]);

    expect(palmares.sections.map((section) => section.category)).toEqual([
      "grand_tour_monument",
      "elite",
      "world",
      "continental",
      "national",
      "regional",
      "junior",
    ]);
    expect(palmares.podiumCount).toBe(7);
  });

  it("classe les victoires avant les deuxièmes et troisièmes places", () => {
    const palmares = buildCareerPalmares([
      entry({ resultId: "third", rank: 3 }),
      entry({ resultId: "second", rank: 2 }),
      entry({ resultId: "first", rank: 1 }),
    ]);

    expect(
      palmares.sections[0]?.achievements.map((achievement) => achievement.rank),
    ).toEqual([1, 2, 3]);
  });
});
