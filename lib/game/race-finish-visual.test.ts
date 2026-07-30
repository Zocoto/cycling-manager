import { describe, expect, it } from "vitest";

import {
  buildSprintVisualBattle,
  buildSprintVisualTeams,
  FINISH_LINE_REVEAL_METERS,
  getFinalApproachDisplayPosition,
  getFinalApproachPosition,
  getFinalGroupEntryPosition,
  getFinalReplayFrame,
  getFinalReplayMeters,
  getFinishPassageDurationMs,
  getFinishPassagePosition,
  getFinishTargetPosition,
  getSmallGroupFinishPosition,
  getVisibleFinalBattleRiderIds,
  keepPassageWinnerVisible,
  shouldWinnerCelebrate,
} from "./race-finish-visual";
import type { FinalBattleScenario } from "./race-simulation";

const scenario: FinalBattleScenario = {
  contenderIds: ["leader-1", "leader-2", "joiner-1", "joiner-2"],
  decisiveContenderIds: ["leader-1", "joiner-1", "joiner-2"],
  droppedRiderIds: ["leader-2"],
  entryLeaderIds: ["leader-1", "leader-2"],
  entryGroupLabel: "Échappée",
  entryGroups: [
    {
      id: "leaders",
      label: "Échappée",
      gapToLeaderSeconds: 0,
      riderIds: ["leader-1", "leader-2"],
    },
    {
      id: "chasers",
      label: "Peloton",
      gapToLeaderSeconds: 20,
      riderIds: ["joiner-1", "joiner-2"],
    },
  ],
  lateJoiners: [
    {
      riderId: "joiner-1",
      fromGroupLabel: "Peloton",
      gapToLeaderSeconds: 8,
    },
    {
      riderId: "joiner-2",
      fromGroupLabel: "Peloton",
      gapToLeaderSeconds: 20,
    },
  ],
};

describe("final race visualization", () => {
  it("ne place dans un train que le poisson-pilote et le sprinteur réels", () => {
    const teams = buildSprintVisualTeams([
      { id: "leader", teamId: "team-a", role: "leader" },
      { id: "domestique-1", teamId: "team-a", role: "domestique" },
      { id: "leadout", teamId: "team-a", role: "leadout" },
      { id: "sprinter", teamId: "team-a", role: "sprinter" },
      { id: "free", teamId: "team-b", role: "free_agent" },
    ]);

    expect(teams).toEqual([
      {
        teamId: "team-a",
        riderIds: ["leader", "domestique-1", "leadout", "sprinter"],
        trainRiderIds: ["leadout", "sprinter"],
      },
      {
        teamId: "team-b",
        riderIds: ["free"],
        trainRiderIds: [],
      },
    ]);
  });

  it("nomme les favoris et permet à un sprinteur de prendre une roue adverse", () => {
    const riders = [
      createSprintVisualRider("favori-a", "team-a", 84),
      createSprintVisualRider("favori-b", "team-b", 82),
      createSprintVisualRider("favori-c", "team-c", 80),
    ];
    const results = riders.map((rider, index) => ({
      riderId: rider.id,
      status: "finished" as const,
      rank: index + 1,
      energyAfter: 58,
    }));
    const battle = buildSprintVisualBattle({
      riders,
      results,
      seed: "wheel-test",
    });

    expect(battle.favoriteRiderIds).toEqual([
      "favori-a",
      "favori-b",
      "favori-c",
    ]);
    expect(battle.wheelTargetByRiderId["favori-b"]).toBe(
      "favori-a"
    );
  });

  it("distingue une démonstration nette d'un sprint encore indécis", () => {
    const dominantRiders = [
      createSprintVisualRider("dominant", "team-a", 94, 90),
      createSprintVisualRider("challenger", "team-b", 74, 72),
      createSprintVisualRider("third", "team-c", 72, 72),
    ];
    const closeRiders = [
      createSprintVisualRider("close-a", "team-a", 84, 82),
      createSprintVisualRider("close-b", "team-b", 84, 82),
      createSprintVisualRider("close-c", "team-c", 83, 82),
    ];
    const toResults = (riders: typeof dominantRiders) =>
      riders.map((rider, index) => ({
        riderId: rider.id,
        status: "finished" as const,
        rank: index + 1,
        energyAfter: 60,
      }));

    expect(
      buildSprintVisualBattle({
        riders: dominantRiders,
        results: toResults(dominantRiders),
        seed: "dominant-test",
      }).dominantWinnerId
    ).toBe("dominant");
    expect(
      buildSprintVisualBattle({
        riders: closeRiders,
        results: toResults(closeRiders),
        seed: "close-test",
      }).dominantWinnerId
    ).toBeNull();
  });

  it("garde le vainqueur d'un GPM visible et en tête du passage", () => {
    expect(
      keepPassageWinnerVisible({
        orderedRiderIds: ["a", "b", "c", "d", "e", "winner"],
        winnerRiderId: "winner",
      })
    ).toEqual(["a", "b", "c", "d", "winner"]);
  });

  it("conserve tous les groupes visibles dès l'entrée du dernier tronçon", () => {
    expect(getVisibleFinalBattleRiderIds(scenario, 0)).toEqual(
      scenario.contenderIds
    );
    expect(getVisibleFinalBattleRiderIds(scenario, 0.5)).toEqual(
      scenario.contenderIds
    );
  });

  it("consacre huit secondes au dernier kilomètre à vitesse normale", () => {
    const parameters = {
      startedWithMeters: 1_000,
      finalSegmentMeters: 10_000,
      playbackSpeed: 1,
      approachDurationMs: 6_000,
    };

    expect(
      getFinalReplayMeters({ ...parameters, elapsedMs: 4_000 })
    ).toBe(500);
    expect(
      getFinalReplayMeters({ ...parameters, elapsedMs: 8_000 })
    ).toBe(0);
  });

  it("prolonge le replay jusqu'au passage de tous les coureurs visibles", () => {
    const parameters = {
      startedWithMeters: 1_000,
      finalSegmentMeters: 10_000,
      playbackSpeed: 1,
      approachDurationMs: 6_000,
    };

    expect(getFinalReplayFrame({ ...parameters, elapsedMs: 8_000 })).toEqual({
      metersRemaining: 0,
      finishPassageProgress: 0,
      complete: false,
    });
    expect(
      getFinalReplayFrame({ ...parameters, elapsedMs: 13_000 }).complete
    ).toBe(true);
    expect(
      getFinalReplayFrame({
        ...parameters,
        elapsedMs: 68_000,
        finishPassageDurationMs: 61_000,
      }).complete
    ).toBe(false);
    expect(
      getFinalReplayFrame({
        ...parameters,
        elapsedMs: 69_000,
        finishPassageDurationMs: 61_000,
      }).complete
    ).toBe(true);
  });

  it("ne révèle la ligne qu'à 500 m et garde le vainqueur derrière jusqu'à 0 m", () => {
    expect(FINISH_LINE_REVEAL_METERS).toBe(500);
    const approachAt425Meters = getFinalApproachDisplayPosition({
      desiredPosition: 90,
      metersRemaining: 425,
      finishLinePosition: 86,
      rank: 1,
    });
    const displayedPositionAt425Meters = getFinishPassagePosition({
      approachPosition: approachAt425Meters,
      rank: 1,
      riderCount: 11,
      gapToWinnerSeconds: 0,
      maximumGapToWinnerSeconds: 60,
      finishPassageProgress: 0,
      finishLinePosition: 86,
      winnerHasFinished: false,
    });

    expect(approachAt425Meters).toBeCloseTo(63.46, 1);
    expect(displayedPositionAt425Meters).toBe(approachAt425Meters);
    expect(displayedPositionAt425Meters).toBeLessThan(70);
    expect(
      getFinalApproachDisplayPosition({
        desiredPosition: 90,
        metersRemaining: 400,
        finishLinePosition: 86,
        rank: 1,
      })
    ).toBeLessThan(86);
    expect(
      getFinalApproachDisplayPosition({
        desiredPosition: 90,
        metersRemaining: 1,
        finishLinePosition: 86,
        rank: 1,
      })
    ).toBeLessThan(86);
    expect(
      getFinalApproachDisplayPosition({
        desiredPosition: 90,
        metersRemaining: 0,
        finishLinePosition: 86,
        rank: 1,
      })
    ).toBe(86);
  });

  it("ne fait franchir la ligne qu'au vainqueur au moment du verdict", () => {
    const finishLinePosition = 86;
    expect(
      getFinishTargetPosition({
        rank: 1,
        hasFinished: false,
        finishLinePosition,
      })
    ).toBeLessThan(finishLinePosition);
    expect(
      getFinishTargetPosition({
        rank: 1,
        hasFinished: true,
        finishLinePosition,
      })
    ).toBeGreaterThan(finishLinePosition);
    expect(
      getFinishTargetPosition({
        rank: 2,
        hasFinished: true,
        finishLinePosition,
      })
    ).toBeLessThan(finishLinePosition);
  });

  it("lève les bras sur une victoire nette mais garde le guidon au photo-finish", () => {
    expect(
      shouldWinnerCelebrate({
        metersRemaining: 180,
        isPhotoFinish: false,
      }),
    ).toBe(true);
    expect(
      shouldWinnerCelebrate({
        metersRemaining: 181,
        isPhotoFinish: false,
      }),
    ).toBe(false);
    expect(
      shouldWinnerCelebrate({
        metersRemaining: 0,
        isPhotoFinish: true,
      }),
    ).toBe(false);
  });

  it("sépare deux groupes selon l'écart réel à l'entrée du tronçon", () => {
    const leadingGroup = Array.from({ length: 5 }, (_, riderIndex) =>
      getFinalGroupEntryPosition({
        groupGapSeconds: 0,
        riderIndex,
        groupSize: 5,
      })
    );
    const chasingGroup = Array.from({ length: 3 }, (_, riderIndex) =>
      getFinalGroupEntryPosition({
        groupGapSeconds: 60,
        riderIndex,
        groupSize: 3,
      })
    );

    expect(Math.min(...leadingGroup)).toBeGreaterThan(
      Math.max(...chasingGroup)
    );
  });

  it("fait franchir la ligne à chaque coureur selon son écart officiel", () => {
    const maximumGapToWinnerSeconds = 60;
    const passageDurationSeconds =
      getFinishPassageDurationMs(maximumGapToWinnerSeconds) / 1_000;
    const winnerApproach = getFinalApproachPosition({
      rank: 1,
      gapToWinnerSeconds: 0,
      finishLinePosition: 86,
    });
    const runnerUpApproach = getFinalApproachPosition({
      rank: 2,
      gapToWinnerSeconds: 3,
      finishLinePosition: 86,
    });
    const delayedApproach = getFinalApproachPosition({
      rank: 6,
      gapToWinnerSeconds: 60,
      finishLinePosition: 86,
    });
    const positionAtSecond = (
      approachPosition: number,
      rank: number,
      gapToWinnerSeconds: number,
      elapsedSeconds: number
    ) =>
      getFinishPassagePosition({
        approachPosition,
        rank,
        riderCount: 8,
        gapToWinnerSeconds,
        maximumGapToWinnerSeconds,
        finishPassageProgress: elapsedSeconds / passageDurationSeconds,
        finishLinePosition: 86,
        winnerHasFinished: true,
      });

    expect(getFinishPassageDurationMs(60)).toBe(61_000);
    expect(positionAtSecond(winnerApproach, 1, 0, 0)).toBe(86);
    expect(positionAtSecond(winnerApproach, 1, 0, 0.1)).toBeGreaterThan(86);
    const runnerUpAtStart = positionAtSecond(runnerUpApproach, 2, 3, 0);
    const runnerUpHalfway = positionAtSecond(runnerUpApproach, 2, 3, 1.5);
    const delayedAtStart = positionAtSecond(delayedApproach, 6, 60, 0);
    const delayedHalfway = positionAtSecond(delayedApproach, 6, 60, 30);

    expect(runnerUpHalfway).toBeGreaterThan(runnerUpAtStart);
    expect(runnerUpHalfway).toBeLessThan(86);
    expect(positionAtSecond(runnerUpApproach, 2, 3, 3.2)).toBeGreaterThan(86);
    expect(delayedHalfway).toBeGreaterThan(delayedAtStart);
    expect(delayedHalfway).toBeLessThan(86);
    expect(positionAtSecond(delayedApproach, 6, 60, 60.4)).toBeGreaterThan(86);
  });

  it("donne neuf positions d'entrée distinctes à un groupe de neuf", () => {
    const positions = Array.from({ length: 9 }, (_, riderIndex) =>
      getSmallGroupFinishPosition({
        riderIndex,
        riderCount: 9,
        decisiveIndex: riderIndex,
        decisiveCount: 9,
        droppedIndex: -1,
        droppedCount: 0,
        lateJoinerGapSeconds: null,
        finalProgress: 0,
        battleProgress: 0,
        visualSeed: 17,
        hasFinished: false,
        finishLinePosition: 86,
      })
    );

    expect(new Set(positions).size).toBe(9);
  });

  it("place le vainqueur devant tous les autres sur la ligne", () => {
    const positions = Array.from({ length: 9 }, (_, riderIndex) =>
      getSmallGroupFinishPosition({
        riderIndex,
        riderCount: 9,
        decisiveIndex: riderIndex,
        decisiveCount: 9,
        droppedIndex: -1,
        droppedCount: 0,
        lateJoinerGapSeconds: null,
        finalProgress: 1,
        battleProgress: 1,
        visualSeed: 17,
        hasFinished: true,
        finishLinePosition: 86,
      })
    );

    expect(positions[0]).toBeGreaterThan(86);
    expect(positions[0]).toBe(Math.max(...positions));
    expect(positions.every((position, index) =>
      index === 0 || position < positions[index - 1]
    )).toBe(true);
  });

  it("maintient les coureurs lâchés derrière ceux qui jouent la victoire", () => {
    const leaders = [0, 1, 2].map((decisiveIndex) =>
      getSmallGroupFinishPosition({
        riderIndex: decisiveIndex,
        riderCount: 9,
        decisiveIndex,
        decisiveCount: 3,
        droppedIndex: -1,
        droppedCount: 6,
        lateJoinerGapSeconds: null,
        finalProgress: 1,
        battleProgress: 1,
        visualSeed: 5,
        hasFinished: true,
        finishLinePosition: 86,
      })
    );
    const dropped = Array.from({ length: 6 }, (_, droppedIndex) =>
      getSmallGroupFinishPosition({
        riderIndex: droppedIndex + 3,
        riderCount: 9,
        decisiveIndex: -1,
        decisiveCount: 3,
        droppedIndex,
        droppedCount: 6,
        lateJoinerGapSeconds: null,
        finalProgress: 1,
        battleProgress: 1,
        visualSeed: 5,
        hasFinished: true,
        finishLinePosition: 86,
      })
    );

    expect(Math.max(...dropped)).toBeLessThan(Math.min(...leaders));
  });
});

function createSprintVisualRider(
  id: string,
  teamId: string,
  sprint: number,
  acceleration = 78
) {
  return {
    id,
    name: id,
    teamId,
    role: "sprinter" as const,
    ratings: {
      flat: 70,
      mountain: 45,
      hills: 52,
      cobbles: 50,
      downhill: 60,
      sprint,
      acceleration,
      timeTrial: 55,
      prologue: 58,
      endurance: 65,
      resistance: 65,
      recovery: 60,
      breakaway: 45,
    },
  };
}