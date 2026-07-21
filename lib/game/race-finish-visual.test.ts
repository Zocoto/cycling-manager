import { describe, expect, it } from "vitest";

import {
  getFinalReplayMeters,
  getFinishTargetPosition,
  getVisibleFinalBattleRiderIds,
} from "./race-finish-visual";
import type { FinalBattleScenario } from "./race-simulation";

const scenario: FinalBattleScenario = {
  contenderIds: ["leader-1", "leader-2", "joiner-1", "joiner-2"],
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
});
