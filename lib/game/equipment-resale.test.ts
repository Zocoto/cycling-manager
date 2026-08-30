import { describe, expect, it } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS } from "@/lib/game/equipment";
import {
  calculateEquipmentResalePrice,
  calculateResearchPrototypeResalePrice,
} from "@/lib/game/equipment-resale";

describe("equipment resale price", () => {
  it("reprend un achat commercial à environ la moitié de son prix", () => {
    expect(
      calculateEquipmentResalePrice({
        purchasePrice: 11_800,
        rarity: "performance",
        effects: EMPTY_EQUIPMENT_EFFECTS,
      }),
    ).toBe(5_900);
  });

  it("valorise une récompense sans prix selon ses bonus", () => {
    expect(
      calculateEquipmentResalePrice({
        purchasePrice: 0,
        rarity: "common",
        effects: {
          ...EMPTY_EQUIPMENT_EFFECTS,
          ratingBonuses: { endurance: 1 },
        },
      }),
    ).toBe(400);
  });

  it("applique un plancher cohérent aux récompenses premium", () => {
    expect(
      calculateEquipmentResalePrice({
        purchasePrice: 0,
        rarity: "premium",
        effects: EMPTY_EQUIPMENT_EFFECTS,
      }),
    ).toBe(2_500);
  });
});

describe("research prototype resale price", () => {
  it("values a neutral prototype at 5,000 euros", () => {
    expect(
      calculateResearchPrototypeResalePrice({
        effects: EMPTY_EQUIPMENT_EFFECTS,
      }),
    ).toBe(5_000);
  });

  it("raises the price with positive statistics", () => {
    expect(
      calculateResearchPrototypeResalePrice({
        effects: {
          ...EMPTY_EQUIPMENT_EFFECTS,
          ratingBonuses: { mountain: 3 },
          timeTrialRatingBonuses: { timeTrial: 1 },
        },
      }),
    ).toBe(9_000);
  });

  it("lowers the price after a statistical setback", () => {
    const improved = calculateResearchPrototypeResalePrice({
      effects: {
        ...EMPTY_EQUIPMENT_EFFECTS,
        ratingBonuses: { mountain: 4 },
      },
    });
    const setback = calculateResearchPrototypeResalePrice({
      effects: {
        ...EMPTY_EQUIPMENT_EFFECTS,
        ratingBonuses: { mountain: 2 },
      },
    });
    const negative = calculateResearchPrototypeResalePrice({
      effects: {
        ...EMPTY_EQUIPMENT_EFFECTS,
        ratingBonuses: { mountain: -2 },
      },
    });

    expect(setback).toBeLessThan(improved);
    expect(negative).toBe(3_000);
  });
});
