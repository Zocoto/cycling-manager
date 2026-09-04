import { describe, expect, it } from "vitest";

import {
  isRacePreparationStageAvailable,
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

  it.each([
    "continental_championship",
    "world_championship",
  ] as const)("disconnects team plans from %s road races", (competitionType) => {
    expect(
      isRacePreparationStageAvailable({
        edition: { competitionType },
        stage: { stageType: "road" },
      }),
    ).toBe(false);
  });

  it.each([
    "individual_time_trial",
    "team_time_trial",
    "prologue",
  ] as const)("keeps individual preparation for %s", (stageType) => {
    expect(
      isRacePreparationStageAvailable({
        edition: { competitionType: "world_championship" },
        stage: { stageType },
      }),
    ).toBe(true);
  });
});

describe("race preparation completion", () => {
  it("considers a road plan complete once its strategy is saved", () => {
    expect(
      isRaceStagePreparationPending({
        edition: { competitionType: "standard" },
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
        edition: { competitionType: "world_championship" },
        stage: { stageType: "individual_time_trial" },
        plan: {
          updatedAt: "2026-09-01T10:00:00.000Z",
          timeTrialUpdatedAt: null,
        },
        scheduled: true,
      }),
    ).toBe(true);
  });

  it("never reports an international road team plan as pending", () => {
    expect(
      isRaceStagePreparationPending({
        edition: { competitionType: "continental_championship" },
        stage: { stageType: "road" },
        plan: undefined,
        scheduled: true,
      }),
    ).toBe(false);
  });
});
