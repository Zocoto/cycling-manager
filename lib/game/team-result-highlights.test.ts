import { describe, expect, it } from "vitest";

import {
  countTeamVictories,
  isMajorTeamResult,
  selectRecentMajorTeamResults,
  selectSeasonTeamPalmares,
  type TeamResultCandidate,
} from "./team-result-highlights";

function result(
  overrides: Partial<TeamResultCandidate> = {}
): TeamResultCandidate {
  return {
    id: "result-1",
    kind: "race",
    seasonId: "season-1",
    dayNumber: 10,
    calendarDate: "2026-07-26",
    raceName: "Course test",
    raceSlug: "course-test",
    raceFormat: "one_day",
    categoryCode: "national",
    prestigeRank: 4,
    competitionType: "standard",
    rank: 1,
    riderName: "Alice Martin",
    stageNumber: null,
    stageName: null,
    classificationType: null,
    ...overrides,
  };
}

describe("team result highlights", () => {
  it("conserve toutes les victoires mais écarte les places secondaires obscures", () => {
    expect(isMajorTeamResult(result({ rank: 1 }))).toBe(true);
    expect(isMajorTeamResult(result({ rank: 5 }))).toBe(false);
    expect(isMajorTeamResult(result({ rank: 10 }))).toBe(false);
  });

  it("retient les podiums Mondial et les Top 5 Elite", () => {
    expect(
      isMajorTeamResult(
        result({ categoryCode: "world", prestigeRank: 2, rank: 3 })
      )
    ).toBe(true);
    expect(
      isMajorTeamResult(
        result({ categoryCode: "elite", prestigeRank: 1, rank: 5 })
      )
    ).toBe(true);
    expect(
      isMajorTeamResult(
        result({ categoryCode: "world", prestigeRank: 2, rank: 5 })
      )
    ).toBe(false);
  });

  it("retient les podiums de championnats indépendamment de leur catégorie", () => {
    expect(
      isMajorTeamResult(
        result({ competitionType: "national_road", rank: 3 })
      )
    ).toBe(true);
  });

  it("ne remonte que les victoires d’étape et annexes de haut niveau", () => {
    expect(
      isMajorTeamResult(
        result({
          kind: "stage",
          raceFormat: "stage_race",
          categoryCode: "elite",
          prestigeRank: 1,
        })
      )
    ).toBe(true);
    expect(
      isMajorTeamResult(
        result({ kind: "stage", raceFormat: "stage_race", rank: 1 })
      )
    ).toBe(false);
    expect(
      isMajorTeamResult(
        result({
          kind: "classification",
          raceFormat: "stage_race",
          categoryCode: "world",
          prestigeRank: 2,
          classificationType: "mountain",
        })
      )
    ).toBe(true);
  });

  it("limite le palmarès aux résultats les plus importants", () => {
    const palmares = selectSeasonTeamPalmares(
      [
        result({ id: "national-win", raceName: "Critérium local" }),
        result({
          id: "elite-podium",
          raceName: "Monument",
          categoryCode: "elite",
          prestigeRank: 1,
          rank: 2,
        }),
        result({ id: "minor-fifth", rank: 5 }),
      ],
      2
    );

    expect(palmares.map((entry) => entry.id)).toEqual([
      "elite-podium",
      "national-win",
    ]);
  });

  it("utilise une fenêtre glissante de sept jours de jeu", () => {
    const recent = selectRecentMajorTeamResults({
      candidates: [
        result({ id: "day-4", dayNumber: 4 }),
        result({ id: "day-5", dayNumber: 5 }),
        result({ id: "day-11", dayNumber: 11 }),
        result({ id: "future", dayNumber: 12 }),
      ],
      activeSeasonId: "season-1",
      currentDayNumber: 11,
    });

    expect(recent.map((entry) => entry.id)).toEqual(["day-11", "day-5"]);
  });

  it("compte les victoires finales et d’étape sans les classements annexes", () => {
    expect(
      countTeamVictories([
        result({ id: "race-win" }),
        result({ id: "stage-win", kind: "stage" }),
        result({ id: "jersey", kind: "classification" }),
        result({ id: "podium", rank: 2 }),
      ])
    ).toBe(2);
  });
});
