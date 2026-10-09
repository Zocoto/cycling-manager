import { describe, expect, it } from "vitest";

import {
  getRiderArchiveReason,
  isRiderArchiveReason,
  RIDER_ARCHIVE_REASON_LABELS,
} from "@/lib/game/rider-career-archive";

describe("rider career archival", () => {
  it("keeps legacy archive reasons readable and recognizes the new rule", () => {
    for (const reason of Object.keys(RIDER_ARCHIVE_REASON_LABELS)) {
      expect(isRiderArchiveReason(reason)).toBe(true);
    }
    expect(isRiderArchiveReason("unknown")).toBe(false);
    expect(RIDER_ARCHIVE_REASON_LABELS.two_seasons_without_team)
      .toBe("Deux saisons complètes consécutives sans équipe");
  });
  it("keeps riders who had both a team and a race start", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: true,
        hasRaceParticipation: true,
      }),
    ).toBeNull();
  });

  it("keeps a rider after only one full season without a team", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: false,
        hasRaceParticipation: true,
        consecutiveFullSeasonsWithoutTeam: 1,
      }),
    ).toBeNull();
  });

  it("never retires a contracted rider solely for not racing", () => {
    expect(
      getRiderArchiveReason({
        existedAtSeasonStart: true,
        hasTeam: true,
        hasRaceParticipation: false,
      }),
    ).toBeNull();
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

  it("retires only after two complete consecutive seasons without a team", () => {
    expect(getRiderArchiveReason({ existedAtSeasonStart: true, hasTeam: false,
      hasRaceParticipation: true, consecutiveFullSeasonsWithoutTeam: 2,
    })).toBe("two_seasons_without_team");
  });

  it("preserves unattached riders with UCI points", () => {
    expect(getRiderArchiveReason({ existedAtSeasonStart: true, hasTeam: false,
      hasRaceParticipation: true, consecutiveFullSeasonsWithoutTeam: 3,
      hasFreeAgentUciPoints: true,
    })).toBeNull();
  });
});
