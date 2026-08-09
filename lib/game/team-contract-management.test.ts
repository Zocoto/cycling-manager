import { describe, expect, it } from "vitest";

import { resolveTeamContractRiderStatus } from "@/lib/game/team-contract-management";

const TEAM_ID = "team-a";

describe("team contract management", () => {
  it("marks an expiring contract without successor as eligible", () => {
    expect(
      resolveTeamContractRiderStatus({
        currentContractEndYear: 2026,
        currentSeasonYear: 2026,
        currentTeamId: TEAM_ID,
        successorTeamId: null,
      }),
    ).toBe("eligible");
  });

  it("recognizes a renewal signed with the current team", () => {
    expect(
      resolveTeamContractRiderStatus({
        currentContractEndYear: 2026,
        currentSeasonYear: 2026,
        currentTeamId: TEAM_ID,
        successorTeamId: TEAM_ID,
      }),
    ).toBe("renewed");
  });

  it("protects contracts already covering the next season", () => {
    expect(
      resolveTeamContractRiderStatus({
        currentContractEndYear: 2027,
        currentSeasonYear: 2026,
        currentTeamId: TEAM_ID,
        successorTeamId: null,
      }),
    ).toBe("covered");
  });

  it("does not renew a rider already committed elsewhere", () => {
    expect(
      resolveTeamContractRiderStatus({
        currentContractEndYear: 2026,
        currentSeasonYear: 2026,
        currentTeamId: TEAM_ID,
        successorTeamId: "team-b",
      }),
    ).toBe("leaving");
  });
});
