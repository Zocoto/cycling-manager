import { describe, expect, it } from "vitest";

import {
  calculateSponsorRenewalBudget,
  getSponsorRenewalBudgetAdjustmentPercent,
} from "./sponsor-renewal-budget";

describe("getSponsorRenewalBudgetAdjustmentPercent", () => {
  it.each([
    [0, -25],
    [25, -12.5],
    [50, 0],
    [75, 5],
    [100, 10],
  ])("convertit %s %% de satisfaction en %s %%", (score, expected) => {
    expect(getSponsorRenewalBudgetAdjustmentPercent(score)).toBe(expected);
  });

  it("borne le score entre 0 et 100", () => {
    expect(getSponsorRenewalBudgetAdjustmentPercent(-20)).toBe(-25);
    expect(getSponsorRenewalBudgetAdjustmentPercent(130)).toBe(10);
  });
});

describe("calculateSponsorRenewalBudget", () => {
  it.each([
    [0, 750_000],
    [25, 875_000],
    [50, 1_000_000],
    [75, 1_050_000],
    [100, 1_100_000],
  ])("applique le score %s au budget courant", (score, expected) => {
    expect(
      calculateSponsorRenewalBudget({
        currentBudget: 1_000_000,
        satisfactionScore: score,
      }),
    ).toBe(expected);
  });
});
