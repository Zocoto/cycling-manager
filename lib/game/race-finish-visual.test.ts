import { describe, expect, it } from "vitest";

import {
  buildSprintVisualBattle,
  buildSprintVisualTeams,
  getFinalReplayMeters,
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

  it("ne montre au début que le groupe de tête puis révèle les coureurs qui recollent", () => {
    expect(getVisibleFinalBattleRiderIds(scenario, 0)).toEqual([
      "leader-1",
      "leader-2",
    ]);
    expect(getVisibleFinalBattleRiderIds(scenario, 0.5)).toContain(
      "joiner-1"
    );
    expect(getVisibleFinalBattleRiderIds(scenario, 1)).toEqual(
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
        metersRemaining: 35,
        isPhotoFinish: false,
      }),
    ).toBe(true);
    expect(
      shouldWinnerCelebrate({
        metersRemaining: 36,
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