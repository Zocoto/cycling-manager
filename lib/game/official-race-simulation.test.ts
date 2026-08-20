import { describe, expect, it } from "vitest";

import {
  getPersistedStageResultUnavailableRiderIds,
  getPersistedUnavailableRiderIdsAtStageDeparture,
  isUnavailableForFollowingStage,
  normalizeOfficialStageResultRanks,
  simulationStartsUnavailableRider,
} from "./official-race-simulation";
import type { StageSimulationResult } from "./race-simulation";

function createResult(
  status: StageSimulationResult["results"][number]["status"]
): StageSimulationResult["results"][number] {
  return {
    riderId: "rider-1",
    rank: status === "finished" ? 1 : null,
    status,
    elapsedTimeSeconds: 10_000,
    gapToWinnerSeconds: 0,
    energyAfter: 40,
    injury: null,
    abandonment: null,
  };
}

describe("isUnavailableForFollowingStage", () => {
  it("keeps a classified rider in the stage race", () => {
    expect(
      isUnavailableForFollowingStage(createResult("finished"))
    ).toBe(false);
  });

  it("removes an outside-time-limit rider from following stages", () => {
    expect(
      isUnavailableForFollowingStage(
        createResult("outside_time_limit")
      )
    ).toBe(true);
  });

  it("detects a locked stage that incorrectly restarts a non-starter", () => {
    expect(
      simulationStartsUnavailableRider(
        { results: [createResult("finished")] },
        new Set(["rider-1"]),
      ),
    ).toBe(true);
    expect(
      simulationStartsUnavailableRider(
        { results: [createResult("finished")] },
        new Set(["another-rider"]),
      ),
    ).toBe(false);
  });
});

describe("normalizeOfficialStageResultRanks", () => {
  it("referme les trous laissés par les coureurs retirés", () => {
    const first = createResult("finished");
    const second = { ...createResult("finished"), riderId: "rider-2", rank: 6 };
    const third = { ...createResult("finished"), riderId: "rider-3", rank: 10 };
    const abandoned = {
      ...createResult("did_not_finish"),
      riderId: "rider-4",
    };

    expect(
      normalizeOfficialStageResultRanks({
        stageId: "stage",
        seed: "seed",
        resolvedRiders: [],
        timeline: [],
        results: [first, second, third, abandoned],
        primes: [],
        mountainPoints: {},
        sprintPoints: {},
      }).results.map((result) => result.rank),
    ).toEqual([1, 2, 3, null]);
  });
});

describe("getPersistedUnavailableRiderIdsAtStageDeparture", () => {
  const departureAt = "2026-08-20T12:00:00.000Z";

  it("exclut une blessure de fatigue active au départ", () => {
    expect(
      getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt,
        windows: [
          {
            riderId: "fatigue-after-stage-10",
            startedAt: "2026-08-19T17:00:00.000Z",
            expectedRecoveryAt: "2026-08-22T17:00:00.000Z",
            recoveredAt: null,
          },
        ],
      }),
    ).toEqual(["fatigue-after-stage-10"]);
  });

  it("reconstruit l'éligibilité historique sans dépendre de la date courante", () => {
    expect(
      getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt,
        windows: [
          {
            riderId: "recovered-later",
            startedAt: "2026-08-19T17:00:00.000Z",
            expectedRecoveryAt: "2026-08-22T17:00:00.000Z",
            recoveredAt: "2026-08-22T17:00:00.000Z",
          },
        ],
      }),
    ).toEqual(["recovered-later"]);
  });

  it("n'exclut ni une blessure future, ni un coureur déjà rétabli", () => {
    expect(
      getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt,
        windows: [
          {
            riderId: "future-injury",
            startedAt: "2026-08-20T13:00:00.000Z",
            expectedRecoveryAt: "2026-08-23T13:00:00.000Z",
            recoveredAt: null,
          },
          {
            riderId: "recovered-before-start",
            startedAt: "2026-08-18T12:00:00.000Z",
            expectedRecoveryAt: "2026-08-21T12:00:00.000Z",
            recoveredAt: "2026-08-20T11:00:00.000Z",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("ignore une étape sans horaire exploitable et déduplique les coureurs", () => {
    const windows = [
      {
        riderId: "same-rider",
        startedAt: "2026-08-19T17:00:00.000Z",
        expectedRecoveryAt: "2026-08-22T17:00:00.000Z",
        recoveredAt: null,
      },
      {
        riderId: "same-rider",
        startedAt: "2026-08-19T18:00:00.000Z",
        expectedRecoveryAt: "2026-08-23T18:00:00.000Z",
        recoveredAt: null,
      },
    ];

    expect(
      getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt: null,
        windows,
      }),
    ).toEqual([]);
    expect(
      getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt,
        windows,
      }),
    ).toEqual(["same-rider"]);
  });
});

describe("getPersistedStageResultUnavailableRiderIds", () => {
  it("propage toutes les indisponibilités officielles aux étapes suivantes du même tour", () => {
    const unavailabilities = [
      { raceEditionId: "tour-a", stageNumber: 10, riderId: "nikolic" },
      { raceEditionId: "tour-a", stageNumber: 10, riderId: "ardennes" },
      { raceEditionId: "tour-b", stageNumber: 2, riderId: "other-race" },
      { raceEditionId: "tour-a", stageNumber: 11, riderId: "current-stage" },
    ];

    expect(
      getPersistedStageResultUnavailableRiderIds({
        raceEditionId: "tour-a",
        stageNumber: 11,
        unavailabilities,
      }),
    ).toEqual(["ardennes", "nikolic"]);
  });

  it("ne retire pas le coureur de l'étape où l'incident a eu lieu", () => {
    expect(
      getPersistedStageResultUnavailableRiderIds({
        raceEditionId: "tour-a",
        stageNumber: 10,
        unavailabilities: [
          { raceEditionId: "tour-a", stageNumber: 10, riderId: "injured" },
        ],
      }),
    ).toEqual([]);
  });
});
