import { describe, expect, it } from "vitest";

import { buildPersistedGeneralClassification } from "./race-results";

const coquinous = {
  riderId: "rider-coquinous",
  riderName: "Paul Rapide",
  teamId: "team-coquinous",
  teamName: "Les Coquinous",
  status: "finished" as const,
  abandonmentReason: null,
};

const challengers = {
  riderId: "rider-challenger",
  riderName: "Jean Vaillant",
  teamId: "team-challenger",
  teamName: "Les Challengers",
  status: "finished" as const,
  abandonmentReason: null,
};

describe("buildPersistedGeneralClassification", () => {
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
});
