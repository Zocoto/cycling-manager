import type { EquipmentSlot } from "@/lib/game/equipment";

export const INVENTORY_CATEGORIES = [
  "special_ability",
  "potential_boost",
  "rating_boost",
  "equipment",
  "other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type StoredInventoryCategory = Exclude<InventoryCategory, "equipment">;
export type InventoryRarity = "common" | "uncommon" | "rare" | "epic";

export type TeamInventoryItem = {
  id: string;
  sourceId: string;
  source: "item" | "equipment";
  category: InventoryCategory;
  name: string;
  description: string;
  effectSummary: string;
  rarity: InventoryRarity;
  quantity: number;
  availableQuantity: number;
  equippedQuantity: number;
  pendingQuantity: number;
  iconKey: string;
  imagePath: string | null;
  supplierName: string | null;
  equipmentSlot: EquipmentSlot | null;
  isConsumable: boolean;
  acquiredAt: string | null;
};

export const INVENTORY_CATEGORY_DEFINITIONS = [
  {
    category: "special_ability",
    label: "Capacités",
    shortLabel: "Capa spéciale",
    description: "Objets qui débloquent durablement une capacité spéciale.",
  },
  {
    category: "potential_boost",
    label: "Potentiel",
    shortLabel: "Potentiel",
    description: "Objets rares qui améliorent le potentiel de progression.",
  },
  {
    category: "rating_boost",
    label: "Statistiques",
    shortLabel: "Bonus de stat",
    description: "Objets d’entraînement qui renforcent directement une statistique.",
  },
  {
    category: "equipment",
    label: "Matériel",
    shortLabel: "Matériel",
    description: "Pièces achetées dans la boutique et attribuables aux coureurs.",
  },
  {
    category: "other",
    label: "Divers",
    shortLabel: "Divers",
    description: "Consommables et futurs objets de gestion de l’équipe.",
  },
] as const satisfies ReadonlyArray<{
  category: InventoryCategory;
  label: string;
  shortLabel: string;
  description: string;
}>;

export function isInventoryCategory(value: string): value is InventoryCategory {
  return (INVENTORY_CATEGORIES as readonly string[]).includes(value);
}

export function getInventoryCategory(category: InventoryCategory) {
  return INVENTORY_CATEGORY_DEFINITIONS.find(
    (definition) => definition.category === category
  )!;
}

export function getInventoryRarityLabel(rarity: InventoryRarity): string {
  return {
    common: "Courant",
    uncommon: "Peu courant",
    rare: "Rare",
    epic: "Exceptionnel",
  }[rarity];
}

export function summarizeInventory(items: ReadonlyArray<TeamInventoryItem>) {
  return items.reduce(
    (summary, item) => ({
      references: summary.references + 1,
      totalUnits: summary.totalUnits + item.quantity,
      availableUnits: summary.availableUnits + item.availableQuantity,
      equipmentUnits:
        summary.equipmentUnits + (item.category === "equipment" ? item.quantity : 0),
    }),
    { references: 0, totalUnits: 0, availableUnits: 0, equipmentUnits: 0 }
  );
}
