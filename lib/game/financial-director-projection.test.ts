import { describe, expect, it } from "vitest";
import { buildFinancialDirectorProjection, type FinancialDirectorProjectionRow } from "./financial-director-projection";
import { buildFinanceProjection } from "./economy";
import { buildFinanceIncomeAnalysis } from "./finance-income-analysis";
import { buildFinanceExpenseAnalysis } from "./finance-expense-analysis";

const salary = {
  id: "salary", sourceReference: "staff-contract:contract:season:2", dayNumber: 14,
  amount: -1000, category: "staff_salary", status: "pending" as const,
  description: "Salaire", postedAt: null,
};
const savings: FinancialDirectorProjectionRow = {
  source_reference: "financial-director:salary-savings:salary", source_transaction_id: "salary",
  day_number: 14, amount: "40.00", effect: "staff_salary", base_amount: "1000",
  bonus_percentage: "4", description: "Économie staff",
};
const daily: FinancialDirectorProjectionRow = {
  source_reference: "financial-director:daily:day14", source_transaction_id: null,
  day_number: 14, amount: "450", effect: "daily_income", base_amount: null,
  bonus_percentage: null, description: "Revenus quotidiens",
};

describe("financial director projection", () => {
  it("keeps gross charges intact, puts both benefits in income and only the forecast curve", () => {
    const original = structuredClone(salary);
    const result = buildFinancialDirectorProjection([salary], [savings, daily]);
    const entries = [salary, ...result.transactions];
    expect(salary).toEqual(original);
    expect(result.transactions.every((entry) => entry.status === "pending" && entry.postedAt === null)).toBe(true);
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-510);
    expect(buildFinanceIncomeAnalysis(entries).totalAmount).toBe(490);
    expect(buildFinanceExpenseAnalysis(entries).totalAmount).toBe(1000);
    const chart = buildFinanceProjection({ currentDayNumber: 13, openingBalance: 2000, entries });
    expect(chart[13].projectedBalance).toBe(1490);
    expect(chart[12].actualBalance).toBe(2000);
    expect(result.effects[0]).toMatchObject({ amount: 40, baseAmount: 1000, bonusPercentage: 4, sourceTransactionId: "salary" });
    expect(result.effects[1]).toMatchObject({ amount: 450, baseAmount: null, bonusPercentage: null, sourceTransactionId: null });
  });

  for (const status of ["pending", "posted", "cancelled"] as const) {
    it(`prefers a real ${status} receipt over an RPC forecast during settlement`, () => {
      const receipt = { ...salary, id: "receipt", sourceReference: savings.source_reference,
        amount: 40, category: "other", status };
      const result = buildFinancialDirectorProjection([salary, receipt], [savings, savings]);
      expect(result.transactions).toHaveLength(0);
      expect(result.effects).toHaveLength(status === "cancelled" ? 0 : 1);
    });
  }

  it("deduplicates RPC rows and retains cent amounts", () => {
    const result = buildFinancialDirectorProjection([salary], [{ ...savings, amount: "40.17" }, savings]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(40.17);
    expect(result.transactions[0].sourceReference).toBe(savings.source_reference);
    expect(result.transactions[0].id).toBe(`df-projection:${savings.source_reference}`);
  });

  it("derives historical rates from real credits, never current DF level", () => {
    const result = buildFinancialDirectorProjection([
      { ...salary, status: "posted" },
      { ...salary, id: "receipt", sourceReference: savings.source_reference, amount: 22,
        category: "other", status: "posted" },
    ], [{ ...savings, amount: 100, bonus_percentage: 10 }]);
    expect(result.effects[0]).toMatchObject({ amount: 22, status: "posted" });
    expect(result.effects[0].bonusPercentage).toBeCloseTo(2.2);
    expect(result.transactions).toHaveLength(0);
  });

  it("classifies all real positive credit sources while ignoring cancelled or negative credits", () => {
    const sources = [
      { ...salary, id: "rider", category: "rider_salary" },
      { ...salary, id: "race", category: "race_prize", amount: 1000 },
      { ...salary, id: "main", category: "sponsor", amount: 1000, sourceReference: "sponsor:contract:2" },
      { ...salary, id: "secondary", category: "sponsor", amount: 1000, sourceReference: "secondary-sponsor-objective:contract:x" },
    ];
    const receipts = sources.map((source) => ({ ...source, id: `receipt:${source.id}`, category: "other",
      sourceReference: `financial-director:${source.amount < 0 ? "salary-savings" : "bonus"}:${source.id}`, amount: 20, status: "posted" as const }));
    const result = buildFinancialDirectorProjection([...sources, ...receipts,
      { ...receipts[0], id: "negative", amount: -20 },
      { ...receipts[0], id: "cancelled", status: "cancelled" },
      { ...receipts[0], id: "daily", sourceReference: daily.source_reference, amount: 450 },
    ], []);
    expect(result.effects.map((effect) => effect.effect)).toEqual(["rider_salary", "race_prize", "main_sponsor", "secondary_sponsor", "daily_income"]);
  });

  it("does not invent base/rate for credits whose source is absent", () => {
    const receipt = { ...salary, sourceReference: "financial-director:bonus:missing", amount: 40 };
    expect(buildFinancialDirectorProjection([receipt], []).effects).toHaveLength(0);
    expect(receipt.amount).toBe(40);
  });

  for (const override of [{ amount: "NaN" }, { amount: -1 }, { day_number: 29 }, { day_number: 0 }, { base_amount: "oops" }]) {
    it(`rejects malformed estimates ${JSON.stringify(override)}`, () => {
      expect(() => buildFinancialDirectorProjection([], [{ ...savings, ...override }])).toThrow("Projection du directeur financier invalide");
    });
  }
  it("adds nothing when no DF is employed", () => {
    expect(buildFinancialDirectorProjection([salary], [])).toEqual({ transactions: [], effects: [] });
  });
});
