import { describe, expect, it } from "vitest";

import {
  isRaceStagePreparationPending,
  isTimeTrialPreparationStage,
} from "@/lib/game/race-preparation";

describe("race preparation stage eligibility", () => {
  it.each([
    "individual_time_trial",
    "team_time_trial",
    "prologue",
  ] as const)("disables planning for %s", (stageType) => {
    expect(isTimeTrialPreparationStage({ stageType })).toBe(true);
  });

  it("keeps road stages plannable", () => {
    expect(isTimeTrialPreparationStage({ stageType: "road" })).toBe(false);
  });
});

describe("race preparation completion", () => {
  it("considers a road plan complete once its strategy is saved", () => {
    expect(
      isRaceStagePreparationPending({
        stage: { stageType: "road" },
        plan: {
          updatedAt: "2026-09-01T10:00:00.000Z",
          timeTrialUpdatedAt: null,
        },
        scheduled: true,
      }),
    ).toBe(false);
  });

  it("uses the dedicated timestamp for a time trial", () => {
    expect(
      isRaceStagePreparationPending({
        stage: { stageType: "individual_time_trial" },
        plan: {
          updatedAt: "2026-09-01T10:00:00.000Z",
          timeTrialUpdatedAt: null,
        },
        scheduled: true,
      }),
    ).toBe(true);
  });
});
