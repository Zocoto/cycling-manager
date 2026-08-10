import { describe, expect, it } from "vitest";

import { isTimeTrialPreparationStage } from "@/lib/game/race-preparation";

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
