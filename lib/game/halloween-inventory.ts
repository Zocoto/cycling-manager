import { HALLOWEEN_PREVIEW_ITEMS, halloweenPresentationEffect, type HalloweenPreviewItem } from "./halloween-catalog";
import type { TeamInventoryItem, InventoryCategory } from "./inventory";

const frameClaim: HalloweenPreviewItem = {
  id: "headless-frame-claim", name: "Monture de l’équipier sans tête", kind: "consumable",
  art: "headless-frame", price: null,
  description: "Votre cadre exclusif attend d’être récupéré dans le matériel de votre équipe.",
  effect: "Transfère une fois le cadre remporté dans l’inventaire de matériel de votre équipe active.",
  status: "Effet existant · dose à valider",
};
const catalog = new Map([...HALLOWEEN_PREVIEW_ITEMS, frameClaim].map(item => [item.id, item]));

/** Expose usable objects only; permanent avatar cosmetics belong to the wardrobe. */
export function halloweenToInventoryItems(
  inventory: Record<string, unknown> = {},
): TeamInventoryItem[] {
  return Object.entries(inventory).flatMap(([id, quantity]) => {
    const item = catalog.get(id);
    if (!item || item.kind === "cosmetic" || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
    return [{
      id: `halloween:${id}`, sourceId: id, catalogKey: id, source: "halloween",
      category: categoryFor(id), name: item.name, description: item.description,
      effectSummary: halloweenPresentationEffect(item, true), resalePrice: null,
      rarity: item.relic || item.price === null ? "epic" : "uncommon",
      quantity, availableQuantity: quantity, equippedQuantity: 0,
      pendingQuantity: 0, equippedRiderIds: [], pendingRiderIds: [],
      iconKey: item.art, imagePath: null, supplierName: "Halloween", equipmentSlot: null,
      isConsumable: true, acquiredAt: null, halloween: item,
    } satisfies TeamInventoryItem];
  });
}

function categoryFor(id: string): InventoryCategory {
  if (id === "witches-star") return "potential_boost";
  if (id === "mummy-bandage" || id === "mummy-resurrection") return "injury_care";
  return "other";
}

export function halloweenInventoryItemHref(id: string) {
  return `/jeu/halloween?onglet=collection#halloween-item-${encodeURIComponent(id)}`;
}
