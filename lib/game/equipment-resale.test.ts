import { describe, expect, it } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS } from "@/lib/game/equipment";
import { calculateEquipmentResalePrice } from "@/lib/game/equipment-resale";

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
