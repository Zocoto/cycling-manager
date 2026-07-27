import { describe, expect, it } from "vitest";

import {
  isTeamRosterAtCapacity,
  MAX_TEAM_ROSTER_SIZE,
} from "@/lib/game/team-roster-capacity";

describe("team roster capacity", () => {
  it("sets the professional roster limit to 35 riders", () => {
    expect(MAX_TEAM_ROSTER_SIZE).toBe(35);
  });

  it("considers the roster full from the thirty-fifth rider", () => {
    expect(isTeamRosterAtCapacity(34)).toBe(false);
    expect(isTeamRosterAtCapacity(35)).toBe(true);
    expect(isTeamRosterAtCapacity(36)).toBe(true);
  });
});
