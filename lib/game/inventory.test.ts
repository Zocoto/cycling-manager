import { describe, expect, it } from "vitest";

import {
  getInventoryCategory,
  getInventoryItemLevel,
  getInventoryRarityLabel,
  dailyRewardsToInventoryItems,
  isAssignableInventoryCategory,
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
  resalePrice: null,
  rarity: "common",
  quantity: 2,
  availableQuantity: 2,
  equippedQuantity: 0,
  pendingQuantity: 0,
  equippedRiderIds: [],
  pendingRiderIds: [],
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
    expect(isInventoryCategory("injury_care")).toBe(true);
    expect(isInventoryCategory("unknown")).toBe(false);
    expect(isAssignableInventoryCategory("special_ability")).toBe(true);
    expect(isAssignableInventoryCategory("potential_boost")).toBe(true);
    expect(isAssignableInventoryCategory("rating_boost")).toBe(true);
    expect(isAssignableInventoryCategory("equipment")).toBe(false);
  });

  it("expose des libellés lisibles", () => {
    expect(getInventoryCategory("special_ability").label).toBe("Capacités");
    expect(getInventoryCategory("injury_care").label).toBe("Soins");
    expect(getInventoryRarityLabel("epic")).toBe("Exceptionnel");
    expect(getInventoryItemLevel({ level: 8 })).toBe(8);
    expect(getInventoryItemLevel({ level: 11 })).toBeNull();
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

  it("expose une pile quotidienne unique dans l’inventaire général", () => {
    const items = dailyRewardsToInventoryItems([
      {
        id: "daily-1",
        key: "secondary-technique",
        name: "Perfectionnement technique",
        description: "",
        effectSummary: "+1 statistique",
        importance: 5,
        effectKind: "rating_boost",
        iconKey: "rating",
        payload: { amount: 1, statScope: "secondary" },
        quantity: 3,
        acquiredAt: "2026-08-16T08:00:00Z",
        expiresAfterGameYear: 3,
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        id: "daily-reward:secondary-technique",
        source: "daily_reward",
        category: "rating_boost",
        quantity: 3,
        availableQuantity: 3,
        dailyReward: expect.objectContaining({ quantity: 3 }),
      }),
    ]);
  });

  it("range les cadeaux de soin dans leur rubrique dédiée", () => {
    const [item] = dailyRewardsToInventoryItems([
      {
        id: "daily-care",
        key: "injury-care-cryotherapy-pack",
        name: "Pack de cryothérapie",
        description: "",
        effectSummary: "Réduit la convalescence de 6 h.",
        importance: 2,
        effectKind: "injury_care",
        iconKey: "medical",
        payload: { recoveryHours: 6, level: 2 },
        quantity: 1,
        acquiredAt: "2026-08-27T08:00:00Z",
        expiresAfterGameYear: 3,
      },
    ]);

    expect(item).toEqual(
      expect.objectContaining({ category: "injury_care", rarity: "common" }),
    );
  });
});
