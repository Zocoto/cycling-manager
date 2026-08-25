import { describe, expect, it } from "vitest";

import {
  buildFinanceExpenseAnalysis,
  classifyFinanceExpense,
  type FinanceExpenseSourceTransaction,
} from "@/lib/game/finance-expense-analysis";

describe("finance expense analysis", () => {
  it.each([
    ["training", "nutrition-intervention:1", "nutrition"],
    ["training", "form-camp-batch:1", "form_camps"],
    ["training", "race-reconnaissance:1", "race_preparation"],
    ["training", "youth-tuition:1:s2:2", "youth_development"],
    ["staff_salary", "staff-dismissal:1", "staff_management"],
    ["other", "fan-club:stock:jersey:1", "fan_club"],
    ["medical_care", "medical-treatment:1", "medical_care"],
    ["rider_salary", "rider-salary:1:2", "rider_salaries"],
  ] as const)(
    "classe %s / %s dans %s",
    (category, sourceReference, expected) => {
      expect(classifyFinanceExpense({ category, sourceReference })).toBe(
        expected,
      );
    },
  );

  it("répartit les charges engagées entre comptabilisé et prévu", () => {
    const analysis = buildFinanceExpenseAnalysis([
      transaction("rider", -60_000, "rider_salary", "posted"),
      transaction("staff", -20_000, "staff_salary", "pending"),
      transaction(
        "nutrition",
        -10_000,
        "training",
        "posted",
        "nutrition-intervention:1",
      ),
      transaction("gain", 30_000, "sponsor", "posted"),
      transaction("cancelled", -50_000, "equipment", "cancelled"),
    ]);

    expect(analysis).toMatchObject({
      totalAmount: 90_000,
      postedAmount: 70_000,
      pendingAmount: 20_000,
      salaryAmount: 80_000,
    });
    expect(analysis.salaryPercentage).toBeCloseTo(88.89, 1);
    expect(analysis.breakdown.map((item) => item.key)).toEqual([
      "rider_salaries",
      "staff_salaries",
      "nutrition",
    ]);
  });
});

function transaction(
  id: string,
  amount: number,
  category: string,
  status: FinanceExpenseSourceTransaction["status"],
  sourceReference = `${category}:${id}`,
): FinanceExpenseSourceTransaction {
  return { id, amount, category, status, sourceReference };
}
