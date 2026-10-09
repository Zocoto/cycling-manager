import { describe, expect, it } from "vitest";
import { halloweenInventoryItemHref, halloweenToInventoryItems } from "./halloween-inventory";
import { summarizeInventory } from "./inventory";

describe("objets Halloween dans l’inventaire principal", () => {
  it("affiche les deux tisanes du portefeuille sans les recréer", () => {
    const stock = { "spectres-tea": 2 };
    const items = halloweenToInventoryItems(stock);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: "halloween", sourceId: "spectres-tea",
      name: "Tisane du spectre", category: "other", quantity: 2, availableQuantity: 2 });
    expect(items[0].description).toContain("−1 kg");
    expect(summarizeInventory(items)).toMatchObject({ totalUnits: 2, availableUnits: 2, references: 1 });
    expect(stock).toEqual({ "spectres-tea": 2 });
    expect(halloweenToInventoryItems({ "spectres-tea": 1 })[0].quantity).toBe(1);
    expect(halloweenToInventoryItems({ "spectres-tea": 0 })).toEqual([]);
  });
  it("conserve les cosmétiques portés sans les compter comme libres", () => {
    const item = halloweenToInventoryItems({ "pumpkin-cap": 1 }, { hat: "pumpkin-cap" })[0];
    expect(item).toMatchObject({ quantity: 1, availableQuantity: 0, equippedQuantity: 1, isConsumable: false });
  });
  it("range les soins et le potentiel dans leurs catégories sans changer les actions", () => {
    const items = halloweenToInventoryItems({ "mummy-bandage": 3, "witches-star": 1, "vampire-kiss": 2 });
    expect(items.map(item => item.category)).toEqual(["injury_care", "potential_boost", "other"]);
    expect(items.every(item => item.source === "halloween")).toBe(true);
  });
  it("montre le cadre restant à réclamer et ignore les entrées invalides", () => {
    expect(halloweenToInventoryItems({ "headless-frame-claim": 1 })[0].sourceId).toBe("headless-frame-claim");
    expect(halloweenToInventoryItems({ unknown: 1, "spectres-tea": -1, "pumpkin-juice": "2", "mummy-bandage": 1.5 })).toEqual([]);
    expect(halloweenToInventoryItems()).toEqual([]);
  });
  it("pointe sur l’objet précis dans la collection utilisable", () => {
    expect(halloweenInventoryItemHref("spectres-tea")).toBe("/jeu/halloween?onglet=collection#halloween-item-spectres-tea");
  });
});
