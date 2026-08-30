import { describe, expect, it } from "vitest";

import {
  describeEquipmentRndEngineerEffects,
  EQUIPMENT_RND_MAX_BONUS,
  estimateEquipmentRndResearch,
  getEquipmentRndBaseDurationDays,
  getEquipmentRndBonusTotal,
  isEquipmentPrototypeNameValid,
  normalizeEquipmentPrototypeName,
  type EquipmentRndEngineer,
} from "@/lib/game/equipment-rnd";

const engineer = (overrides: Partial<EquipmentRndEngineer> = {}) => ({
  contractId: "contract-rnd",
  name: "Ada Prototype",
  level: 2,
  specialties: [
    "research_time",
    "research_cost",
    "research_success",
  ],
  specialty: "research_time",
  ...overrides,
}) satisfies EquipmentRndEngineer;

describe("equipment R&D engineer talents", () => {
  it("normalizes and validates the custom prototype name", () => {
    expect(normalizeEquipmentPrototypeName("  Aquila   RS-X  ")).toBe(
      "Aquila RS-X",
    );
    expect(isEquipmentPrototypeNameValid("RS")).toBe(false);
    expect(isEquipmentPrototypeNameValid("Aquila RS-X")).toBe(true);
    expect(isEquipmentPrototypeNameValid("x".repeat(61))).toBe(false);
  });

  it("keeps research free and uses the unmodified item baseline", () => {
    expect(
      estimateEquipmentRndResearch({ labLevel: 1 }),
    ).toEqual({ successRate: 50, durationDays: 1, cost: 0 });
  });

  it("applies the building efficiency bonus to the laboratory contribution", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 5,
        labEfficiencyBonusPercentage: 10,
      }),
    ).toEqual({ successRate: 73, durationDays: 1, cost: 0 });
  });

  it("applies every unlocked engineer talent cumulatively", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 1,
        existingBonusTotal: 3,
        engineer: engineer(),
      }),
    ).toEqual({ successRate: 56, durationDays: 4, cost: 0 });
  });

  it("keeps an incompressible one-day research minimum", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 7,
        existingBonusTotal: 1,
        engineer: engineer({ level: 7 }),
      }).durationDays,
    ).toBe(1);
  });

  it("keeps compatibility with a single legacy specialty", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 1,
        existingBonusTotal: 1,
        engineer: engineer({
          specialties: [],
          specialty: "research_success",
        }),
      }),
    ).toEqual({ successRate: 56, durationDays: 2, cost: 0 });
  });

  it.each([
    [0, 1],
    [1, 2],
    [2, 4],
    [3, 6],
    [4, 8],
    [5, 10],
    [6, 12],
    [7, 16],
    [8, 20],
    [9, 24],
    [EQUIPMENT_RND_MAX_BONUS, 28],
    [EQUIPMENT_RND_MAX_BONUS + 1, 28],
  ])("scales a +%i item to %i base research days", (score, days) => {
    expect(getEquipmentRndBaseDurationDays(score)).toBe(days);
  });

  it("calculates the net cumulative rating bonus across regular and TT effects", () => {
    expect(
      getEquipmentRndBonusTotal({
        ratingBonuses: { mountain: 2, flat: -1 },
        timeTrialRatingBonuses: { timeTrial: 2, prologue: 1 },
      }),
    ).toBe(4);
  });

  it("shows the exact value of every active talent", () => {
    expect(describeEquipmentRndEngineerEffects(engineer())).toEqual([
      "−2 jours",
      "−10 % sur la durée",
      "+6 points de réussite",
    ]);
  });
});
