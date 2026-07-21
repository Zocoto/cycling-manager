import { describe, expect, it } from "vitest";

import {
  getInventoryCategory,
  getInventoryRarityLabel,
  isInventoryCategory,
  summarizeInventory,
  type TeamInventoryItem,
} from "./inventory";

const baseItem: TeamInventoryItem = {
  id: "item:test",
  sourceId: "test",
  source: "item",
  category: "rating_boost",
  name: "Test",
  description: "",
  effectSummary: "+1 ACC",
  rarity: "common",
  quantity: 2,
  availableQuantity: 2,
  equippedQuantity: 0,
  pendingQuantity: 0,
  iconKey: "rating",
  imagePath: null,
  supplierName: null,
  equipmentSlot: null,
  isConsumable: true,
  acquiredAt: null,
};

describe("team inventory", () => {
  it("reconnaît uniquement les catégories d’inventaire", () => {
    expect(isInventoryCategory("equipment")).toBe(true);
    expect(isInventoryCategory("unknown")).toBe(false);
  });

  it("expose des libellés lisibles", () => {
    expect(getInventoryCategory("special_ability").label).toBe("Capacités");
    expect(getInventoryRarityLabel("epic")).toBe("Exceptionnel");
  });

  it("additionne les objets et isole les pièces de matériel", () => {
    expect(
      summarizeInventory([
        baseItem,
        {
          ...baseItem,
          id: "equipment:test",
          source: "equipment",
          category: "equipment",
          quantity: 3,
          availableQuantity: 1,
          equippedQuantity: 2,
        },
      ])
    ).toEqual({
      references: 2,
      totalUnits: 5,
      availableUnits: 3,
      equipmentUnits: 3,
    });
  });
});
