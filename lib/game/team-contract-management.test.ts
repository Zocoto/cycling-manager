import { describe, expect, it } from "vitest";

import {
  canRenewCurrentTeamRiderContract,
  resolveEffectiveTeamContractEndYear,
  resolveTeamContractRiderStatus,
} from "@/lib/game/team-contract-management";

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

  it("displays the end of a renewal signed with the current team", () => {
    expect(
      resolveEffectiveTeamContractEndYear({
        currentContractEndYear: 2,
        currentTeamId: TEAM_ID,
        successorTeamId: TEAM_ID,
        successorContractEndYear: 3,
      }),
    ).toBe(3);
  });

  it("does not extend the displayed term with a contract at another team", () => {
    expect(
      resolveEffectiveTeamContractEndYear({
        currentContractEndYear: 2,
        currentTeamId: TEAM_ID,
        successorTeamId: "team-b",
        successorContractEndYear: 3,
      }),
    ).toBe(2);
  });

  it("stops offering renewal once a next-season contract exists", () => {
    expect(
      canRenewCurrentTeamRiderContract({
        currentContractEndYear: 2,
        currentSeasonYear: 2,
        hasNextSeasonContract: true,
      }),
    ).toBe(false);
  });

  it("offers renewal only for an expiring rider without a successor", () => {
    expect(
      canRenewCurrentTeamRiderContract({
        currentContractEndYear: 2,
        currentSeasonYear: 2,
        hasNextSeasonContract: false,
      }),
    ).toBe(true);
    expect(
      canRenewCurrentTeamRiderContract({
        currentContractEndYear: 3,
        currentSeasonYear: 2,
        hasNextSeasonContract: false,
      }),
    ).toBe(false);
  });
});
