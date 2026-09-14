import { describe, expect, it } from "vitest";

import { resolveStageRaceRole } from "./stage-race-roles";

describe("resolveStageRaceRole", () => {
  it("uses the stage override when one is configured", () => {
    expect(
      resolveStageRaceRole({
        riderId: "rider-a",
        generalRole: "domestique",
        roleOverrides: { "rider-a": "leader" },
      })
    ).toBe("leader");
  });

  it("keeps the declared tour leader in charge on every stage", () => {
    expect(
      resolveStageRaceRole({
        riderId: "leader",
        generalRole: "leader",
        roleOverrides: { leader: "leadout" },
        lockedLeaderRiderId: "leader",
      }),
    ).toBe("leader");
  });

  it("reserves the leader role for the declared tour leader", () => {
    expect(
      resolveStageRaceRole({
        riderId: "teammate",
        generalRole: "domestique",
        roleOverrides: { teammate: "leader" },
        lockedLeaderRiderId: "leader",
      }),
    ).toBe("domestique");
  });

  it("falls back to the general tour role", () => {
    expect(
      resolveStageRaceRole({
        riderId: "rider-b",
        generalRole: "sprinter",
        roleOverrides: { "rider-a": "leader" },
      })
    ).toBe("sprinter");
  });
});
