import { describe, expect, it } from "vitest";

import {
  buildSprintVisualBattle,
  buildSprintVisualRoster,
  buildSprintVisualTeams,
  FINISH_LINE_REVEAL_METERS,
  getFinalApproachDisplayPosition,
  getFinalApproachPosition,
  getFinalGroupEntryPosition,
  getFinalReplayFrame,
  getFinalReplayMeters,
  getMassSprintFinishPosition,
  getMassSprintVisualFrame,
  getMassSprintVisualPhase,
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

  it("limite le final aux trains des principaux sprinteurs", () => {
    const roster = buildSprintVisualRoster({
      maximumTeams: 5,
      riders: [
        { id: "domestique", teamId: "team-a", role: "domestique" },
        { id: "leadout-a1", teamId: "team-a", role: "leadout" },
        { id: "leadout-a2", teamId: "team-a", role: "leadout" },
        { id: "sprinter-a", teamId: "team-a", role: "sprinter" },
        { id: "leadout-b", teamId: "team-b", role: "leadout" },
        { id: "sprinter-b", teamId: "team-b", role: "sprinter" },
        { id: "sprinter-c", teamId: "team-c", role: "sprinter" },
        { id: "sprinter-d", teamId: "team-d", role: "sprinter" },
        { id: "sprinter-e", teamId: "team-e", role: "sprinter" },
        { id: "sprinter-f", teamId: "team-f", role: "sprinter" },
      ],
      favoriteRiderIds: [
        "sprinter-a",
        "sprinter-b",
        "sprinter-c",
        "sprinter-d",
        "sprinter-e",
        "sprinter-f",
      ],
    });

    expect(roster).toHaveLength(5);
    expect(roster[0]).toEqual({
      teamId: "team-a",
      contenderRiderId: "sprinter-a",
      leadoutRiderIds: ["leadout-a1", "leadout-a2"],
      riderIds: ["leadout-a1", "leadout-a2", "sprinter-a"],
    });
    expect(roster.flatMap((team) => team.riderIds)).not.toContain(
      "domestique"
    );
    expect(roster.flatMap((team) => team.riderIds)).not.toContain(
      "sprinter-f"
    );
  });

  it("enchaîne trains, sélection, relais puis duel sans remontada irréaliste", () => {
    expect(getMassSprintVisualPhase(3_000).phase).toBe("trains");
    expect(getMassSprintVisualPhase(1_200).phase).toBe("selection");
    expect(getMassSprintVisualPhase(500).phase).toBe("leadout-release");
    expect(getMassSprintVisualPhase(120).phase).toBe("duel");
    expect(getMassSprintVisualPhase(0).phase).toBe("passage");

    const common = {
      teamIndex: 1,
      teamCount: 4,
      memberCount: 2,
      contenderCount: 4,
      isDominantWinner: false,
      finalTargetPosition: 82,
      visualSeed: 17,
    };
    const trainLeadout = getMassSprintVisualFrame({
      ...common,
      metersRemaining: 3_000,
      memberIndex: 0,
      contenderIndex: -1,
      isLeadout: true,
    });
    const trainSprinter = getMassSprintVisualFrame({
      ...common,
      metersRemaining: 3_000,
      memberIndex: 1,
      contenderIndex: 1,
      isLeadout: false,
    });
    const releasedLeadout = getMassSprintVisualFrame({
      ...common,
      metersRemaining: 300,
      memberIndex: 0,
      contenderIndex: -1,
      isLeadout: true,
    });
    const duelSprinter = getMassSprintVisualFrame({
      ...common,
      metersRemaining: 120,
      memberIndex: 1,
      contenderIndex: 1,
      isLeadout: false,
    });

    expect(trainLeadout.position).toBeGreaterThan(trainSprinter.position);
    expect(releasedLeadout.opacity).toBeLessThan(1);
    expect(duelSprinter.position).toBeGreaterThan(60);
    expect(duelSprinter.position).toBeLessThan(84);
    expect(
      getMassSprintVisualFrame({
        ...common,
        metersRemaining: 0,
        memberIndex: 1,
        contenderIndex: 1,
        isLeadout: false,
      }).position
    ).toBe(82);
  });

  it("calibre les écarts d'un sprint serré entre le pneu et le vélo", () => {
    const winner = getMassSprintFinishPosition({
      contenderIndex: 0,
      gapToWinnerSeconds: 0,
      finishLinePosition: 84,
    });
    const runnerUp = getMassSprintFinishPosition({
      contenderIndex: 1,
      gapToWinnerSeconds: 0,
      finishLinePosition: 84,
    });
    const delayed = getMassSprintFinishPosition({
      contenderIndex: 2,
      gapToWinnerSeconds: 3,
      finishLinePosition: 84,
    });

    expect(winner).toBe(84);
    expect(winner - runnerUp).toBeGreaterThanOrEqual(0.75);
    expect(winner - runnerUp).toBeLessThanOrEqual(4.8);
    expect(delayed).toBeLessThan(runnerUp);
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

  it("garde les dix meilleurs sprinteurs dans le final", () => {
    const riders = Array.from({ length: 12 }, (_, index) =>
      createSprintVisualRider(
        "sprinter-" + (index + 1),
        "team-" + (index + 1),
        94 - index
      )
    );
    const results = riders.map((rider, index) => ({
      riderId: rider.id,
      status: "finished" as const,
      rank: index + 1,
      energyAfter: 60,
    }));

    const battle = buildSprintVisualBattle({
      riders,
      results,
      seed: "top-ten",
    });

    expect(battle.favoriteRiderIds).toHaveLength(10);
    expect(battle.favoriteRiderIds).toContain("sprinter-1");
    expect(battle.favoriteRiderIds).not.toContain("sprinter-12");
  });

  it("garde le sprinteur avec son poisson-pilote et accroche les isolés à un train adverse", () => {
    const sprinterA = createSprintVisualRider("sprinter-a", "team-a", 90);
    const leadoutA = {
      ...createSprintVisualRider("leadout-a", "team-a", 72),
      role: "leadout" as const,
    };
    const sprinterB = createSprintVisualRider("sprinter-b", "team-b", 86);
    const sprinterC = createSprintVisualRider("sprinter-c", "team-c", 82);
    const leadoutC = {
      ...createSprintVisualRider("leadout-c", "team-c", 70),
      role: "leadout" as const,
    };
    const riders = [
      sprinterA,
      leadoutA,
      sprinterB,
      sprinterC,
      leadoutC,
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
      seed: "foreign-train",
    });

    expect(battle.wheelTargetByRiderId["sprinter-a"]).toBeUndefined();
    expect(battle.wheelTargetByRiderId["sprinter-c"]).toBeUndefined();
    expect(battle.wheelTargetByRiderId["sprinter-b"]).toBe("sprinter-a");
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