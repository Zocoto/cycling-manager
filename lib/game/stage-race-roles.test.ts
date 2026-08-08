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
