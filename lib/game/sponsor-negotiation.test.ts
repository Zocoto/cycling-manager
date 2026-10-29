import { describe, expect, it } from "vitest";

import {
  adjustSponsorObjectiveAmbitionLevel,
  calculateSponsorNegotiatedBudget,
  getSponsorNegotiationBudgetCeiling,
} from "./sponsor-negotiation";

describe("sponsor negotiation", () => {
  it("lowers or raises the base budget by ten percent", () => {
    expect(
      calculateSponsorNegotiatedBudget({
        baseBudget: 600_000,
        budgetCeiling: 700_000,
        difficulty: "accessible",
      }),
    ).toBe(540_000);
    expect(
      calculateSponsorNegotiatedBudget({
        baseBudget: 600_000,
        budgetCeiling: 700_000,
        difficulty: "balanced",
      }),
    ).toBe(600_000);
    expect(
      calculateSponsorNegotiatedBudget({
        baseBudget: 600_000,
        budgetCeiling: 700_000,
        difficulty: "ambitious",
      }),
    ).toBe(660_000);
  });

  it("allows the full ambition reward above the catalogue ceiling", () => {
    expect(
      calculateSponsorNegotiatedBudget({
        baseBudget: 680_000,
        budgetCeiling: 700_000,
        difficulty: "ambitious",
      }),
    ).toBe(750_000);
  });

  it("preserves an annual renewal increase already above the catalogue ceiling", () => {
    expect(
      getSponsorNegotiationBudgetCeiling({
        baseBudget: 735_000,
        sponsorMaximumBudget: 700_000,
      }),
    ).toBe(810_000);
  });

  it("keeps the three Terroirs Unis tiers distinct even with an older saved ceiling", () => {
    const baseBudget = 451_810;
    const budgetCeiling = getSponsorNegotiationBudgetCeiling({ baseBudget, sponsorMaximumBudget: 420_000 });
    expect(budgetCeiling).toBe(500_000);
    expect(["accessible", "balanced", "ambitious"].map(difficulty =>
      calculateSponsorNegotiatedBudget({ baseBudget, budgetCeiling: baseBudget, difficulty: difficulty as "accessible" | "balanced" | "ambitious" }),
    )).toEqual([410_000, 451_810, 500_000]);
  });

  it("moves objective ambition one level and clamps the extremes", () => {
    expect(adjustSponsorObjectiveAmbitionLevel(3, "accessible")).toBe(2);
    expect(adjustSponsorObjectiveAmbitionLevel(3, "balanced")).toBe(3);
    expect(adjustSponsorObjectiveAmbitionLevel(3, "ambitious")).toBe(4);
    expect(adjustSponsorObjectiveAmbitionLevel(1, "accessible")).toBe(1);
    expect(adjustSponsorObjectiveAmbitionLevel(6, "ambitious")).toBe(6);
  });
});
