import { describe, expect, it } from "vitest";

import {
  getFinalReplayMeters,
  getFinishTargetPosition,
  getSmallGroupFinishPosition,
  getVisibleFinalBattleRiderIds,
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
