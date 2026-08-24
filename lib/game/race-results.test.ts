import { describe, expect, it } from "vitest";

import {
  buildPersistedGeneralClassification,
  buildPersistedStageRaceStandings,
  isRaceEditionSettlementCandidate,
  normalizeOfficialResultGapsToLeader,
  shouldSettleRaceEdition,
} from "./race-results";

const coquinous = {
  riderId: "rider-coquinous",
  riderName: "Paul Rapide",
  teamId: "team-coquinous",
  teamName: "Les Coquinous",
  rank: 1,
  status: "finished" as const,
  abandonmentReason: null,
};

const challengers = {
  riderId: "rider-challenger",
  riderName: "Jean Vaillant",
  teamId: "team-challenger",
  teamName: "Les Challengers",
  rank: 2,
  status: "finished" as const,
  abandonmentReason: null,
};

describe("race settlement selection", () => {
  const incompleteCompletedIds = new Set(["completed-incomplete"]);
  const now = new Date("2026-08-23T12:20:00.000Z");
  const stage = (
    departureAt: string,
    status: "planned" | "in_progress" | "completed" = "planned",
  ) => ({ departureAt, distanceKm: 120, status });

  it("keeps active races and skips cancelled races", () => {
    expect(
      shouldSettleRaceEdition(
        { id: "planned", status: "planned" },
        incompleteCompletedIds,
      ),
    ).toBe(true);
    expect(
      shouldSettleRaceEdition(
        { id: "cancelled", status: "cancelled" },
        incompleteCompletedIds,
      ),
    ).toBe(false);
  });

  it("repairs only completed editions detected as incomplete", () => {
    expect(
      shouldSettleRaceEdition(
        { id: "completed-incomplete", status: "completed" },
        incompleteCompletedIds,
      ),
    ).toBe(true);
    expect(shouldSettleRaceEdition({ id: "completed-healthy", status: "completed" }, incompleteCompletedIds)).toBe(false);
    expect(
      shouldSettleRaceEdition(
        { id: "completed-but-still-racing", status: "completed" },
        incompleteCompletedIds,
        true,
      ),
    ).toBe(true);
  });

  it("loads only live, finished or explicitly repairable editions", () => {
    expect(
      isRaceEditionSettlementCandidate(
        {
          id: "future",
          status: "scheduled",
          stages: [stage("2026-08-23T16:00:00.000Z")],
        },
        incompleteCompletedIds,
        now,
      ),
    ).toBe(false);
    expect(
      isRaceEditionSettlementCandidate(
        {
          id: "live",
          status: "in_progress",
          stages: [stage("2026-08-23T12:00:00.000Z", "in_progress")],
        },
        incompleteCompletedIds,
        now,
      ),
    ).toBe(true);
    expect(
      isRaceEditionSettlementCandidate(
        {
          id: "finished",
          status: "in_progress",
          stages: [stage("2026-08-23T11:00:00.000Z")],
        },
        incompleteCompletedIds,
        now,
      ),
    ).toBe(true);
    expect(
      isRaceEditionSettlementCandidate(
        {
          id: "completed-incomplete",
          status: "completed",
          stages: [stage("2026-08-23T16:00:00.000Z")],
        },
        incompleteCompletedIds,
        now,
      ),
    ).toBe(true);
  });
});

describe("buildPersistedGeneralClassification", () => {
  it("conserve l'ordre d'arrivee lorsque deux coureurs terminent dans le meme temps", () => {
    const general = buildPersistedGeneralClassification([
      [
        { ...coquinous, elapsedTimeMs: 3_600_000 },
        { ...challengers, elapsedTimeMs: 3_600_000 },
      ],
    ]);

    expect(general.map((result) => result.riderId)).toEqual([
      "rider-coquinous",
      "rider-challenger",
    ]);
    expect(general.map((result) => result.rank)).toEqual([1, 2]);
  });

  it("departage un tour au cumul des places puis au rang de la derniere etape", () => {
    const general = buildPersistedGeneralClassification([
      [
        { ...coquinous, rank: 3, elapsedTimeMs: 3_600_000 },
        { ...challengers, rank: 1, elapsedTimeMs: 3_600_000 },
      ],
      [
        { ...coquinous, rank: 1, elapsedTimeMs: 3_600_000 },
        { ...challengers, rank: 3, elapsedTimeMs: 3_600_000 },
      ],
    ]);

    expect(general.map((result) => result.riderId)).toEqual([
      "rider-coquinous",
      "rider-challenger",
    ]);
  });
  it("cumule précisément les temps des étapes", () => {
    const general = buildPersistedGeneralClassification([
      [
        { ...coquinous, elapsedTimeMs: 3_600_000 },
        { ...challengers, elapsedTimeMs: 3_610_000 },
      ],
      [
        { ...coquinous, elapsedTimeMs: 3_700_000 },
        { ...challengers, elapsedTimeMs: 3_680_000 },
      ],
    ]);

    expect(general.map((result) => result.riderId)).toEqual([
      "rider-challenger",
      "rider-coquinous",
    ]);
    expect(general[0]).toMatchObject({
      rank: 1,
      elapsedTimeMs: 7_290_000,
      gapToWinnerMs: 0,
    });
    expect(general[1]).toMatchObject({
      rank: 2,
      elapsedTimeMs: 7_300_000,
      gapToWinnerMs: 10_000,
    });
  });

  it("déduit les bonifications et ajoute les pénalités au classement général", () => {
    const general = buildPersistedGeneralClassification([
      [
        {
          ...coquinous,
          elapsedTimeMs: 3_600_000,
          timeBonusSeconds: 4,
          timePenaltySeconds: 0,
        },
        {
          ...challengers,
          elapsedTimeMs: 3_604_000,
          timeBonusSeconds: 10,
          timePenaltySeconds: 0,
        },
      ],
      [
        {
          ...coquinous,
          elapsedTimeMs: 3_700_000,
          timeBonusSeconds: 0,
          timePenaltySeconds: 2,
        },
        {
          ...challengers,
          elapsedTimeMs: 3_700_000,
          timeBonusSeconds: 3,
          timePenaltySeconds: 0,
        },
      ],
    ]);

    expect(general.map((result) => result.riderId)).toEqual([
      "rider-challenger",
      "rider-coquinous",
    ]);
    expect(general[0]).toMatchObject({
      elapsedTimeMs: 7_291_000,
      gapToWinnerMs: 0,
    });
    expect(general[1]).toMatchObject({
      elapsedTimeMs: 7_298_000,
      gapToWinnerMs: 7_000,
    });
  });

  it("conserve un abandon en bas et hors du classement général", () => {
    const general = buildPersistedGeneralClassification([
      [
        { ...coquinous, elapsedTimeMs: 3_600_000 },
        { ...challengers, elapsedTimeMs: 3_600_000 },
      ],
      [
        { ...coquinous, elapsedTimeMs: 3_700_000 },
        {
          ...challengers,
          status: "did_not_finish" as const,
          elapsedTimeMs: null,
          abandonmentReason: "crash",
        },
      ],
    ]);

    expect(general[0]).toMatchObject({
      riderId: "rider-coquinous",
      rank: 1,
      status: "finished",
    });
    expect(general[1]).toMatchObject({
      riderId: "rider-challenger",
      rank: null,
      status: "did_not_finish",
      abandonmentReason: "crash",
    });
  });

  it("écarte du général un coureur absent d'une étape (blessé non repartant)", () => {
    const general = buildPersistedGeneralClassification([
      [
        { ...coquinous, elapsedTimeMs: 3_600_000 },
        { ...challengers, elapsedTimeMs: 3_500_000 },
      ],
      [
        // Le challenger, blessé à l'étape 1, ne reprend pas le départ :
        // aucun résultat pour lui sur cette étape.
        { ...coquinous, elapsedTimeMs: 3_700_000 },
      ],
    ]);

    expect(general[0]).toMatchObject({
      riderId: "rider-coquinous",
      rank: 1,
      status: "finished",
      elapsedTimeMs: 7_300_000,
    });
    expect(general[1]).toMatchObject({
      riderId: "rider-challenger",
      rank: null,
      status: "did_not_start",
      elapsedTimeMs: null,
    });
  });

  it("conserve un nom d'équipe historique sans lien vers un profil", () => {
    const general = buildPersistedGeneralClassification([
      [
        {
          ...coquinous,
          teamId: "history-season-1",
          teamProfileId: null,
          teamName: "Vélo Club Amateur",
          elapsedTimeMs: 3_600_000,
        },
      ],
    ]);

    expect(general[0]).toMatchObject({
      teamId: "history-season-1",
      teamProfileId: null,
      teamName: "Vélo Club Amateur",
    });
  });
});

describe("normalizeOfficialResultGapsToLeader", () => {
  it("recalcule chaque écart depuis le temps du leader", () => {
    const results = normalizeOfficialResultGapsToLeader([
      {
        ...coquinous,
        rank: 1,
        elapsedTimeMs: 3_600_000,
        gapToWinnerMs: 0,
        mountainPoints: 0,
        sprintPoints: 0,
      },
      {
        ...challengers,
        rank: 2,
        elapsedTimeMs: 3_608_000,
        gapToWinnerMs: 8_000,
        mountainPoints: 0,
        sprintPoints: 0,
      },
      {
        ...challengers,
        riderId: "rider-third",
        rank: 3,
        elapsedTimeMs: 3_618_000,
        gapToWinnerMs: 10_000,
        mountainPoints: 0,
        sprintPoints: 0,
      },
      {
        ...challengers,
        riderId: "rider-fourth",
        rank: 4,
        elapsedTimeMs: 3_626_000,
        gapToWinnerMs: 8_000,
        mountainPoints: 0,
        sprintPoints: 0,
      },
    ]);

    expect(results.map((result) => result.gapToWinnerMs)).toEqual([
      0, 8_000, 18_000, 26_000,
    ]);
  });
});

describe("buildPersistedStageRaceStandings", () => {
  it("reconstruit les classements annexes depuis les résultats figés", () => {
    const stages = [
      [
        {
          ...coquinous,
          rank: 1,
          elapsedTimeMs: 3_600_000,
          gapToWinnerMs: 0,
          mountainPoints: 8,
          sprintPoints: 2,
        },
        {
          ...challengers,
          rank: 2,
          elapsedTimeMs: 3_610_000,
          gapToWinnerMs: 10_000,
          mountainPoints: 3,
          sprintPoints: 6,
        },
      ],
      [
        {
          ...coquinous,
          rank: 2,
          elapsedTimeMs: 3_700_000,
          gapToWinnerMs: 5_000,
          mountainPoints: 2,
          sprintPoints: 4,
        },
        {
          ...challengers,
          rank: 1,
          elapsedTimeMs: 3_695_000,
          gapToWinnerMs: 0,
          mountainPoints: 9,
          sprintPoints: 1,
        },
      ],
    ];

    const standings = buildPersistedStageRaceStandings(
      stages,
      new Map([
        [coquinous.riderId, 22],
        [challengers.riderId, 28],
      ]),
    );

    expect(standings.mountain.map((row) => row.riderId)).toEqual([
      challengers.riderId,
      coquinous.riderId,
    ]);
    expect(standings.sprint.map((row) => row.riderId)).toEqual([
      challengers.riderId,
      coquinous.riderId,
    ]);
    expect(standings.youth).toEqual([
      { riderId: coquinous.riderId, elapsedTimeSeconds: 7_300 },
    ]);
    expect(standings.teams).toHaveLength(2);
  });

  it("exclut un abandon des classements individuels persistés", () => {
    const standings = buildPersistedStageRaceStandings(
      [
        [
          {
            ...coquinous,
            rank: 1,
            elapsedTimeMs: 3_600_000,
            gapToWinnerMs: 0,
            mountainPoints: 5,
            sprintPoints: 5,
          },
          {
            ...challengers,
            status: "did_not_finish" as const,
            rank: null,
            elapsedTimeMs: null,
            gapToWinnerMs: null,
            mountainPoints: 0,
            sprintPoints: 0,
            abandonmentReason: "crash",
          },
        ],
      ],
      new Map([
        [coquinous.riderId, 22],
        [challengers.riderId, 21],
      ]),
    );

    expect(standings.youth.map((row) => row.riderId)).toEqual([
      coquinous.riderId,
    ]);
    expect(standings.mountain.map((row) => row.riderId)).toEqual([
      coquinous.riderId,
    ]);
  });
});
