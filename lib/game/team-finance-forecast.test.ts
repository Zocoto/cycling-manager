import { describe, expect, it } from "vitest";

import { summarizeFutureFinances } from "@/lib/game/team-finance-forecast";

describe("summarizeFutureFinances", () => {
  it("exclut les gains et charges déjà comptabilisés des montants prévus", () => {
    expect(
      summarizeFutureFinances({
        currentBalance: 858_715,
        entries: [
          { amount: -1_165_780, status: "posted" },
          { amount: 1_250_000, status: "pending" },
          { amount: -1_865_600, status: "pending" },
        ],
      }),
    ).toEqual({
      futureIncome: 1_250_000,
      futureExpenses: 1_865_600,
      futureNet: -615_600,
      projectedBalance: 243_115,
    });
  });

  it("ignore aussi les écritures annulées", () => {
    expect(
      summarizeFutureFinances({
        currentBalance: 100_000,
        entries: [
          { amount: 25_000, status: "posted" },
          { amount: -10_000, status: "cancelled" },
          { amount: 40_000, status: "pending" },
          { amount: -15_000, status: "pending" },
        ],
      }),
    ).toEqual({
      futureIncome: 40_000,
      futureExpenses: 15_000,
      futureNet: 25_000,
      projectedBalance: 125_000,
    });
  });

  it("conserve le solde actuel en l’absence de flux futur", () => {
    expect(
      summarizeFutureFinances({
        currentBalance: 75_000,
        entries: [{ amount: -20_000, status: "posted" }],
      }),
    ).toEqual({
      futureIncome: 0,
      futureExpenses: 0,
      futureNet: 0,
      projectedBalance: 75_000,
    });
  });
});
