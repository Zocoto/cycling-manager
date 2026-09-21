import { describe, expect, it } from "vitest";

import { buildJuniorDevelopmentCareerHistory } from "./development-rider-career-history";

describe("historique Development Team durable", () => {
  it("retrouve une saison depuis les résultats après suppression du roster", () => {
    const history = buildJuniorDevelopmentCareerHistory({
      seasons: [{ id: "season-2", name: "Saison 2", gameYear: 2 }],
      teams: [
        {
          id: "dodo-dev",
          teamId: "dodo",
          seasonId: "season-2",
          displayName: "Dodo Blue Finance Dev Team",
        },
      ],
      rosterTeamIds: [],
      editions: [
        {
          id: "prix-releve",
          seasonId: "season-2",
          name: "Prix de la Relève",
          raceFormat: "one_day",
        },
        {
          id: "tour-releve",
          seasonId: "season-2",
          name: "Tour de la Relève",
          raceFormat: "stage_race",
        },
        {
          id: "paves-nord",
          seasonId: "season-2",
          name: "Pavés du Nord Juniors",
          raceFormat: "one_day",
        },
      ],
      results: [
        result({ raceEditionId: "prix-releve", resultScope: "stage", rank: 1, points: 50 }),
        result({ raceEditionId: "prix-releve", resultScope: "general", rank: 1, points: 100 }),
        result({ raceEditionId: "tour-releve", resultScope: "stage", rank: 1, points: 50 }),
        result({ raceEditionId: "tour-releve", resultScope: "general", rank: 1, points: 100 }),
        result({ raceEditionId: "paves-nord", resultScope: "stage", rank: 1, points: 50 }),
        result({ raceEditionId: "paves-nord", resultScope: "general", rank: 1, points: 100 }),
      ],
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      seasonName: "Saison 2",
      teamName: "Dodo Blue Finance Dev Team",
      victories: 3,
      points: 450,
      juniorRaceCount: 3,
      juniorPodiums: 3,
    });
    expect(history[0]?.notablePerformances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raceEditionId: "tour-releve",
          labels: expect.arrayContaining([
            "1re place au général",
            "1 victoire d'étape",
          ]),
        }),
      ]),
    );
  });

  it("rattache les résultats fédéraux sans DevTeam explicite à la bonne saison", () => {
    const history = buildJuniorDevelopmentCareerHistory({
      seasons: [{ id: "season-3", name: "Saison 3", gameYear: 3 }],
      teams: [
        {
          id: "dev-team",
          teamId: "team",
          seasonId: "season-3",
          displayName: "Équipe Dev Team",
        },
      ],
      rosterTeamIds: [],
      editions: [
        {
          id: "national-road",
          seasonId: "season-3",
          name: "Championnat junior",
          raceFormat: "one_day",
        },
      ],
      results: [
        {
          raceEditionId: "national-road",
          developmentTeamId: null,
          resultScope: "general",
          rank: 2,
          points: 120,
        },
      ],
    });

    expect(history[0]).toMatchObject({
      juniorRaceCount: 1,
      juniorPodiums: 1,
      points: 120,
    });
  });
});

function result({
  raceEditionId,
  resultScope,
  rank,
  points,
}: {
  raceEditionId: string;
  resultScope: "stage" | "general";
  rank: number;
  points: number;
}) {
  return {
    raceEditionId,
    developmentTeamId: "dodo-dev",
    resultScope,
    rank,
    points,
  };
}
