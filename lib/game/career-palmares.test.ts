import { describe, expect, it } from "vitest";

import {
  buildCareerPalmares,
  type CareerDistinctiveJerseyEntry,
  type CareerPalmaresEntry,
  type CareerPalmaresSupplementEntry,
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

function supplement(
  overrides: Partial<CareerPalmaresSupplementEntry> = {},
): CareerPalmaresSupplementEntry {
  return {
    resultId: "stage-1",
    raceKey: "tour-de-france",
    raceName: "Tour de France",
    seasonId: "season-1",
    seasonName: "Saison 1",
    gameYear: 1,
    prestigeRank: 1,
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

  it("regroupe les victoires d’étape par tour et liste chaque saison", () => {
    const stageVictories = [
      supplement(),
      supplement({ resultId: "stage-2" }),
      supplement({
        resultId: "stage-3",
        seasonId: "season-2",
        seasonName: "Saison 2",
        gameYear: 2,
      }),
      supplement({
        resultId: "stage-4",
        raceKey: "tour-des-flandres-par-etapes",
        raceName: "Tour des Flandres",
        prestigeRank: 3,
      }),
    ];

    const palmares = buildCareerPalmares([], { stageVictories });

    expect(palmares.stageVictoryCount).toBe(4);
    expect(palmares.stageVictories).toEqual([
      {
        id: "tour-de-france",
        raceKey: "tour-de-france",
        raceName: "Tour de France",
        count: 3,
        seasonLabels: ["S1", "S2"],
      },
      {
        id: "tour-des-flandres-par-etapes",
        raceKey: "tour-des-flandres-par-etapes",
        raceName: "Tour des Flandres",
        count: 1,
        seasonLabels: ["S1"],
      },
    ]);
  });

  it("distingue les maillots finaux par course et par classement", () => {
    const distinctiveJerseys: CareerDistinctiveJerseyEntry[] = [
      { ...supplement(), classificationType: "mountain" },
      {
        ...supplement({
          resultId: "jersey-2",
          seasonId: "season-3",
          seasonName: "Saison 3",
          gameYear: 3,
        }),
        classificationType: "mountain",
      },
      {
        ...supplement({ resultId: "jersey-3" }),
        classificationType: "sprint",
      },
    ];

    const palmares = buildCareerPalmares([], { distinctiveJerseys });

    expect(palmares.distinctiveJerseyCount).toBe(3);
    expect(palmares.distinctiveJerseys).toEqual([
      expect.objectContaining({
        id: "tour-de-france:mountain",
        classificationType: "mountain",
        count: 2,
        seasonLabels: ["S1", "S3"],
      }),
      expect.objectContaining({
        id: "tour-de-france:sprint",
        classificationType: "sprint",
        count: 1,
        seasonLabels: ["S1"],
      }),
    ]);
    expect(palmares.victoryCount).toBe(0);
    expect(palmares.podiumCount).toBe(0);
  });
});
