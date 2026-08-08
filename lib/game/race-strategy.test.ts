import { describe, expect, it } from "vitest";

import {
  DEFAULT_RACE_TEAM_STRATEGY,
  getRiderRaceDuty,
  type RaceTeamStrategy,
} from "./race-strategy";

describe("race strategy", () => {
  it("keeps a neutral default that does not force a scenario", () => {
    expect(DEFAULT_RACE_TEAM_STRATEGY).toMatchObject({
      objective: "balanced",
      collectivePosture: "balanced",
      breakawayPolicy: "opportunistic",
      chasePolicy: "dangerous_breakaway",
      attackOrders: [],
    });
  });

  it("resolves each exclusive rider duty", () => {
    const strategy: RaceTeamStrategy = {
      teamId: "team-1",
      ...DEFAULT_RACE_TEAM_STRATEGY,
      lieutenantRiderId: "lieutenant",
      dangerPacerRiderId: "pacer",
      protectorRiderId: "protector",
      breakawayRiderId: "attacker",
    };

    expect(getRiderRaceDuty(strategy, "lieutenant")).toBe("lieutenant");
    expect(getRiderRaceDuty(strategy, "pacer")).toBe("danger_pacer");
    expect(getRiderRaceDuty(strategy, "protector")).toBe("protector");
    expect(getRiderRaceDuty(strategy, "attacker")).toBe(
      "breakaway_candidate",
    );
    expect(getRiderRaceDuty(strategy, "another-rider")).toBeNull();
  });
});
