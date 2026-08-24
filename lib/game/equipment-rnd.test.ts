import { describe, expect, it } from "vitest";

import {
  describeEquipmentRndEngineerEffects,
  estimateEquipmentRndResearch,
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
  it("keeps the laboratory baseline without an engineer", () => {
    expect(
      estimateEquipmentRndResearch({ labLevel: 1, itemPrice: 1_000 }),
    ).toEqual({ successRate: 50, durationDays: 5, cost: 162_000 });
  });

  it("applies the building efficiency bonus to the laboratory contribution", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 5,
        labEfficiencyBonusPercentage: 10,
        itemPrice: 1_000,
      }),
    ).toEqual({ successRate: 73, durationDays: 5, cost: 362_000 });
  });

  it("applies every unlocked engineer talent cumulatively", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 1,
        itemPrice: 1_000,
        engineer: engineer(),
      }),
    ).toEqual({ successRate: 56, durationDays: 3, cost: 145_800 });
  });

  it("keeps an incompressible one-day research minimum", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 7,
        itemPrice: 1_000,
        engineer: engineer({ level: 7 }),
      }).durationDays,
    ).toBe(1);
  });

  it("keeps compatibility with a single legacy specialty", () => {
    expect(
      estimateEquipmentRndResearch({
        labLevel: 1,
        itemPrice: 1_000,
        engineer: engineer({
          specialties: [],
          specialty: "research_success",
        }),
      }),
    ).toEqual({ successRate: 56, durationDays: 5, cost: 162_000 });
  });

  it("shows the exact value of every active talent", () => {
    expect(describeEquipmentRndEngineerEffects(engineer())).toEqual([
      "−2 jours",
      "−10 % sur le coût",
      "+6 points de réussite",
    ]);
  });
});
