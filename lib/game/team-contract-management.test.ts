import { describe, expect, it } from "vitest";

import {
  calculateRiderRenewalSalary,
  canRenewCurrentTeamRiderContract,
  getRiderRenewalPremiumPercent,
  getRiderRenewalTargetYears,
  resolveEffectiveTeamContractEndYear,
  resolveTeamContractRiderStatus,
} from "@/lib/game/team-contract-management";

const TEAM_ID = "team-a";

describe("team contract management", () => {
  it("offers S+1 or S+2 for an expiring deal, and only S+2 for a deal ending next season", () => {
    expect(getRiderRenewalTargetYears({ effectiveContractEndYear: 3, currentSeasonYear: 3 })).toEqual([4, 5]);
    expect(getRiderRenewalTargetYears({ effectiveContractEndYear: 4, currentSeasonYear: 3 })).toEqual([5]);
    expect(getRiderRenewalTargetYears({ effectiveContractEndYear: 5, currentSeasonYear: 3 })).toEqual([]);
  });

  it("does not offer a term overlapping a future move to another team", () => {
    expect(getRiderRenewalTargetYears({
      effectiveContractEndYear: 3,
      currentSeasonYear: 3,
      blockingContracts: [{ startYear: 5, endYear: 5 }],
    })).toEqual([4]);
    expect(getRiderRenewalTargetYears({
      effectiveContractEndYear: 4,
      currentSeasonYear: 3,
      blockingContracts: [{ startYear: 5, endYear: 5 }],
    })).toEqual([]);
  });

  it("charges 25% for two extra seasons, including an upgrade of a planned one-season renewal", () => {
    expect(getRiderRenewalPremiumPercent({ activeContractEndYear: 3, currentSeasonYear: 3, targetEndYear: 5 })).toBe(25);
    expect(getRiderRenewalPremiumPercent({ activeContractEndYear: 4, currentSeasonYear: 3, targetEndYear: 5 })).toBe(0);
    expect(calculateRiderRenewalSalary(18_500, 25)).toBe(23_125);
  });

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
