import { describe, expect, it } from "vitest";

import { calculatePurchaseFinancialRisk } from "./purchase-financial-risk";

describe("purchase financial risk", () => {
  it("does not warn while the projected season balance stays non-negative", () => {
    expect(
      calculatePurchaseFinancialRisk({
        currentProjectedBalance: 80_000,
        expense: 30_000,
      }),
    ).toMatchObject({
      projectedBalanceAfterPurchase: 50_000,
      requiresConfirmation: false,
      wasAlreadyNegative: false,
    });
  });

  it("warns when a purchase crosses into a projected deficit", () => {
    expect(
      calculatePurchaseFinancialRisk({
        currentProjectedBalance: 20_000,
        expense: 35_000,
      }),
    ).toMatchObject({
      projectedBalanceAfterPurchase: -15_000,
      requiresConfirmation: true,
      wasAlreadyNegative: false,
    });
  });

  it("warns again when an already negative projection is worsened", () => {
    expect(
      calculatePurchaseFinancialRisk({
        currentProjectedBalance: -12_500,
        expense: 5_000,
      }),
    ).toMatchObject({
      projectedBalanceAfterPurchase: -17_500,
      requiresConfirmation: true,
      wasAlreadyNegative: true,
    });
  });

  it("ignores zero and invalid expenses", () => {
    expect(
      calculatePurchaseFinancialRisk({
        currentProjectedBalance: -12_500,
        expense: Number.NaN,
      }).requiresConfirmation,
    ).toBe(false);
    expect(
      calculatePurchaseFinancialRisk({
        currentProjectedBalance: -12_500,
        expense: 0,
      }).requiresConfirmation,
    ).toBe(false);
  });
});
