import { describe, expect, it } from "vitest";

import {
  calculateRiderRenewalSalary,
  canRenewCurrentTeamRiderContract,
  getRiderRenewalPremiumPercent,
  getRiderRenewalTargetYears,
  getRiderRenewalUpgradeBaseSalary,
  resolveEffectiveTeamContractEndYear,
  resolveTeamContractRiderStatus,
} from "@/lib/game/team-contract-management";

const TEAM_ID = "team-a";

describe("team contract management", () => {
  it.each([0, "0", -5, "-5", "not-a-number", Number.NaN, Number.POSITIVE_INFINITY])(
    "uses a positive salary quote instead of the invalid upgrade base %s",
    (invalidSalary) => {
      expect(getRiderRenewalUpgradeBaseSalary({
        estimatedSalary: 8_000,
        homegrown: false,
        rosterSalaryBeforeDiscount: invalidSalary,
        salaryPerSeason: invalidSalary,
        renewalDiscountPercent: 0,
      })).toBe(8_000);
    },
  );

  it("keeps the homegrown and retention discounts on a legacy free junior upgrade", () => {
    const base = getRiderRenewalUpgradeBaseSalary({
      estimatedSalary: 6_000,
      homegrown: true,
      homegrownSalaryBeforeDiscount: "0",
      rosterSalaryBeforeDiscount: "0",
      salaryPerSeason: "0",
      renewalDiscountPercent: 5,
    });
    expect(base).toBe(2_850);
    expect(calculateRiderRenewalSalary(base, 25)).toBe(3_562.5);
  });

  it("preserves positive signed homegrown bases rather than repricing them", () => {
    expect(getRiderRenewalUpgradeBaseSalary({
      estimatedSalary: 6_000,
      homegrown: true,
      homegrownSalaryBeforeDiscount: "12000",
      rosterSalaryBeforeDiscount: 6_000,
      salaryPerSeason: 5_700,
      renewalDiscountPercent: 5,
    })).toBe(5_700);
  });

  it("preserves a positive retention base and falls through invalid older bases", () => {
    expect(getRiderRenewalUpgradeBaseSalary({
      estimatedSalary: 6_000,
      homegrown: false,
      rosterSalaryBeforeDiscount: "10000",
      salaryPerSeason: 9_500,
      renewalDiscountPercent: 5,
    })).toBe(9_500);
    expect(getRiderRenewalUpgradeBaseSalary({
      estimatedSalary: 6_000,
      homegrown: false,
      rosterSalaryBeforeDiscount: 0,
      salaryPerSeason: 8_000,
      renewalDiscountPercent: 0,
    })).toBe(8_000);
  });

  it("uses the canonical minimum if neither stored bases nor a quote is positive", () => {
    expect(getRiderRenewalUpgradeBaseSalary({
      estimatedSalary: 0,
      homegrown: false,
      salaryPerSeason: 0,
      renewalDiscountPercent: 0,
    })).toBe(6_000);
  });

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
    expect(getRiderRenewalPremiumPercent({ activeContractEndYear: 3, currentSeasonYear: 3, targetEndYear: 5, age: 24 })).toBe(25);
    expect(getRiderRenewalPremiumPercent({ activeContractEndYear: 4, currentSeasonYear: 3, targetEndYear: 5, age: 31 })).toBe(0);
    expect(calculateRiderRenewalSalary(18_500, 25)).toBe(23_125);
  });

  it("réduit de 25 % après 30 ans et conserve les frontières d’âge", () => {
    const renewal = { activeContractEndYear: 4, currentSeasonYear: 4, targetEndYear: 6 };
    expect(getRiderRenewalPremiumPercent({ ...renewal, age: 25 })).toBe(10);
    expect(getRiderRenewalPremiumPercent({ ...renewal, age: 30 })).toBe(10);
    expect(getRiderRenewalPremiumPercent({ ...renewal, age: 31 })).toBe(-25);
    expect(calculateRiderRenewalSalary(16000, -25)).toBe(12000);
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
