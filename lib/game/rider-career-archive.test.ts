import { describe, expect, it } from "vitest";

import { getRiderArchiveReason } from "@/lib/game/rider-career-archive";

describe("rider career archival", () => {
  it("keeps riders who had both a team and a race start", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: true,
        hasRaceParticipation: true,
      }),
    ).toBeNull();
  });

  it("archives a full season without a team", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: false,
        hasRaceParticipation: true,
      }),
    ).toBe("no_team");
  });

  it("archives a full season without a race start", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: true,
        hasRaceParticipation: false,
      }),
    ).toBe("no_race");
  });

  it("does not archive a rider created after the season started", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: false,
        hasTeam: false,
        hasRaceParticipation: false,
      }),
    ).toBeNull();
  });
});