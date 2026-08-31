import { describe, expect, it } from "vitest";

import {
  TEAM_TIME_TRIAL_TEAM_REWARD_CUTOFF_AT,
  shouldRewardTeamTimeTrialByTeam,
} from "./team-time-trial-rewards";

describe("bascule des récompenses TTT collectives", () => {
  it("conserve le règlement historique pour toutes les étapes passées", () => {
    expect(shouldRewardTeamTimeTrialByTeam("2026-08-31T21:59:59.999Z")).toBe(
      false,
    );
    expect(shouldRewardTeamTimeTrialByTeam(null)).toBe(false);
  });

  it("active le classement par équipes à partir du 1er septembre à Paris", () => {
    expect(TEAM_TIME_TRIAL_TEAM_REWARD_CUTOFF_AT).toBe(
      "2026-09-01T00:00:00+02:00",
    );
    expect(shouldRewardTeamTimeTrialByTeam("2026-08-31T22:00:00.000Z")).toBe(
      true,
    );
    expect(shouldRewardTeamTimeTrialByTeam("2026-09-01T14:00:00+02:00")).toBe(
      true,
    );
  });
});
