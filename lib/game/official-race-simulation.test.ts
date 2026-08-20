import { describe, expect, it } from "vitest";

import {
  isUnavailableForFollowingStage,
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
