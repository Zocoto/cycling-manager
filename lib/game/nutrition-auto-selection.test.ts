import { describe, expect, it } from "vitest";
import { getNutritionInterventionOutcome } from "./health-center";
import { buildAutomaticNutritionDrafts, type NutritionistInterventionOption } from "./nutrition-auto-selection";

const specialists: NutritionistInterventionOption[] = [
  { contractId: "junior", name: "Junior", level: 1, remainingCapacity: 1 },
  { contractId: "senior", name: "Senior", level: 3, remainingCapacity: 1 },
  { contractId: "expert", name: "Expert", level: 5, remainingCapacity: 2 },
];
const riders = [
  { riderId: "fresh", form: 95 }, { riderId: "tired", form: 30 },
  { riderId: "middle", form: 70 }, { riderId: "second", form: 50 },
  { riderId: "reserve", form: 99 },
];
function prepare(overrides: Partial<Parameters<typeof buildAutomaticNutritionDrafts>[0]> = {}) {
  return buildAutomaticNutritionDrafts({ riders, nutritionists: specialists, balance: 50_000, ...overrides });
}

describe("automatic nutrition draft", () => {
  it("assigns strongest supplements to the most tired riders, until all daily capacity is used", () => {
    expect(prepare()).toEqual([
      { riderId: "tired", nutritionistContractId: "expert", interventionCode: "elite_recharge" },
      { riderId: "second", nutritionistContractId: "expert", interventionCode: "elite_recharge" },
      { riderId: "middle", nutritionistContractId: "senior", interventionCode: "tailored_plan" },
      { riderId: "fresh", nutritionistContractId: "junior", interventionCode: "recovery_snack" },
    ]);
  });

  it("skips already treated riders, full form and duplicate rider IDs", () => {
    expect(prepare({
      appliedRiderIds: ["tired"],
      riders: [{ riderId: "full", form: 100 }, ...riders, { riderId: "second", form: 50 }, { riderId: "invalid", form: NaN }],
    }).map(draft => draft.riderId)).toEqual(["second", "middle", "fresh", "reserve"]);
  });

  it("keeps the visible order as the tie breaker for equally tired riders", () => {
    expect(prepare({ riders: [{ riderId: "b", form: 50 }, { riderId: "a", form: 50 }] })
      .map(draft => draft.riderId)).toEqual(["b", "a"]);
  });

  it.each([
    { nutritionists: [] },
    { nutritionists: [{ ...specialists[2], remainingCapacity: 0 }] },
    { nutritionists: [{ ...specialists[2], remainingCapacity: -1 }] },
  ])(
    "does not assign unavailable daily capacity %s", ({ nutritionists }) => {
      expect(prepare({ nutritionists })).toEqual([]);
    },
  );

  it("uses actual effectiveness bonuses rather than staff level alone", () => {
    const drafts = prepare({ nutritionists: [specialists[2], { ...specialists[1], additionalFormBonus: 5 }] });
    expect(drafts[0]).toMatchObject({ nutritionistContractId: "senior", interventionCode: "tailored_plan" });
    expect(drafts[1].nutritionistContractId).toBe("expert");
  });

  it("uses the cheapest specialist for equally strong supplements", () => {
    const drafts = prepare({ nutritionists: [
      { ...specialists[2], contractId: "expensive", remainingCapacity: 1 },
      { ...specialists[2], contractId: "discount", remainingCapacity: 1, interventionPrices: { elite_recharge: 1500 } },
    ] });
    expect(drafts.map(draft => draft.nutritionistContractId)).toEqual(["discount", "expensive"]);
  });

  it("falls back to smaller affordable supplements without exceeding the budget", () => {
    const nutritionist = specialists[2];
    const drafts = prepare({ nutritionists: [nutritionist], balance: 2250 });
    expect(drafts.map(draft => draft.interventionCode)).toEqual(["elite_recharge", "recovery_snack"]);
  });

  it("uses effective prices and exact cents, including free supplements", () => {
    expect(prepare({ nutritionists: [{ ...specialists[0], interventionPrices: { recovery_snack: 0.29 } }], balance: 0.29 })).toHaveLength(1);
    expect(prepare({ nutritionists: [{ ...specialists[0], interventionPrices: { recovery_snack: 0 } }], balance: 0 })).toHaveLength(1);
    expect(prepare({ nutritionists: [
      { ...specialists[0], contractId: "a", interventionPrices: { recovery_snack: 0.1 } },
      { ...specialists[0], contractId: "b", interventionPrices: { recovery_snack: 0.2 } },
    ], balance: 0.3 })).toHaveLength(2);
  });

  it.each([0, -10, NaN])("does not prepare an unaffordable plan with budget %s", balance => {
    expect(prepare({ balance })).toEqual([]);
  });

  it("never exceeds the server batch limit", () => {
    expect(prepare({
      riders: Array.from({ length: 40 }, (_, i) => ({ riderId: String(i), form: i })),
      nutritionists: [{ ...specialists[0], remainingCapacity: 100 }],
    })).toHaveLength(35);
  });

  it("does not change the inputs and prepares the same editable draft on repeated clicks", () => {
    const before = JSON.stringify({ riders, specialists });
    expect(prepare()).toEqual(prepare());
    expect(JSON.stringify({ riders, specialists })).toBe(before);
  });

  it("keeps gains non-increasing, respects every capacity, and stays within budget", () => {
    for (const balance of [400, 1000, 2250, 4000, 10_000]) {
      const drafts = prepare({ balance });
      const usage = new Map<string, number>();
      const outcomes = drafts.map(draft => {
        const specialist = specialists.find(option => option.contractId === draft.nutritionistContractId)!;
        usage.set(specialist.contractId, (usage.get(specialist.contractId) ?? 0) + 1);
        return getNutritionInterventionOutcome({ code: draft.interventionCode!, nutritionistLevel: specialist.level });
      });
      expect(outcomes.reduce((sum, outcome) => sum + outcome.price, 0)).toBeLessThanOrEqual(balance);
      for (let index = 1; index < outcomes.length; index += 1) expect(outcomes[index].formGain).toBeLessThanOrEqual(outcomes[index - 1].formGain);
      for (const specialist of specialists) expect(usage.get(specialist.contractId) ?? 0).toBeLessThanOrEqual(specialist.remainingCapacity);
    }
  });
});
