import { describe, expect, it } from "vitest";

import { buildPersistedStageRaceStandings } from "./race-results";

const firstStage = [
  {
    riderId: "young-withdrawn",
    riderName: "Jeune Abandon",
    teamId: "team-a",
    teamProfileId: null,
    teamName: "Equipe A",
    rank: 1,
    status: "finished" as const,
    elapsedTimeMs: 3_600_000,
    gapToWinnerMs: 0,
    mountainPoints: 0,
    sprintPoints: 0,
    abandonmentReason: null,
  },
  {
    riderId: "young-finisher",
    riderName: "Jeune Classe",
    teamId: "team-b",
    teamProfileId: null,
    teamName: "Equipe B",
    rank: 2,
    status: "finished" as const,
    elapsedTimeMs: 3_610_000,
    gapToWinnerMs: 10_000,
    mountainPoints: 0,
    sprintPoints: 0,
    abandonmentReason: null,
  },
];

describe("classement des jeunes d'un tour", () => {
  it("exclut un jeune qui ne repart pas sur une étape suivante", () => {
    const standings = buildPersistedStageRaceStandings(
      [
        firstStage,
        [
          {
            ...firstStage[1],
            rank: 1,
            elapsedTimeMs: 3_620_000,
            gapToWinnerMs: 0,
          },
        ],
      ],
      new Map([
        ["young-withdrawn", 22],
        ["young-finisher", 23],
      ]),
    );

    expect(standings.youth).toEqual([
      { riderId: "young-finisher", elapsedTimeSeconds: 7_230 },
    ]);
  });
});
