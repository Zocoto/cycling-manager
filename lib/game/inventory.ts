import type { EquipmentSlot } from "@/lib/game/equipment";
import {
  groupDailyRewardInventoryItems,
  type DailyRewardInventoryItem,
} from "@/lib/game/daily-rewards";

export const INVENTORY_CATEGORIES = [
  "special_ability",
  "potential_boost",
  "rating_boost",
  "injury_care",
  "equipment",
  "other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type StoredInventoryCategory = Exclude<InventoryCategory, "equipment">;
export type InventoryRarity = "common" | "uncommon" | "rare" | "epic";
export type AssignableInventoryCategory =
  "special_ability" | "potential_boost" | "rating_boost";

export type TeamInventoryItem = {
  id: string;
  sourceId: string;
  catalogKey?: string | null;
  source: "item" | "equipment" | "daily_reward";
  category: InventoryCategory;
  name: string;
  description: string;
  effectSummary: string;
  resalePrice: number | null;
  effectPayload?: Record<string, unknown>;
  rarity: InventoryRarity;
  quantity: number;
  availableQuantity: number;
  equippedQuantity: number;
  pendingQuantity: number;
  equippedRiderIds: string[];
  pendingRiderIds: string[];
  iconKey: string;
  imagePath: string | null;
  supplierName: string | null;
  equipmentSlot: EquipmentSlot | null;
  isConsumable: boolean;
  acquiredAt: string | null;
  dailyReward?: DailyRewardInventoryItem | null;
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
    description:
      "Objets d’entraînement qui renforcent directement une statistique.",
  },
  {
    category: "injury_care",
    label: "Soins",
    shortLabel: "Soin médical",
    description:
      "Objets médicaux qui raccourcissent une blessure compatible en cours.",
  },
  {
    category: "equipment",
    label: "Matériel",
    shortLabel: "Matériel",
    description:
      "Pièces achetées dans la boutique et attribuables aux coureurs.",
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

export function isAssignableInventoryCategory(
  value: string,
): value is AssignableInventoryCategory {
  return (
    value === "special_ability" ||
    value === "potential_boost" ||
    value === "rating_boost"
  );
}

export function getInventoryCategory(category: InventoryCategory) {
  return INVENTORY_CATEGORY_DEFINITIONS.find(
    (definition) => definition.category === category,
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

export function getInventoryItemLevel(
  effectPayload: Record<string, unknown> | undefined,
): number | null {
  const parsed = Number(effectPayload?.level);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10
    ? parsed
    : null;
}

export function summarizeInventory(items: ReadonlyArray<TeamInventoryItem>) {
  return items.reduce(
    (summary, item) => ({
      references: summary.references + 1,
      totalUnits: summary.totalUnits + item.quantity,
      availableUnits: summary.availableUnits + item.availableQuantity,
      equipmentUnits:
        summary.equipmentUnits +
        (item.category === "equipment" ? item.quantity : 0),
    }),
    { references: 0, totalUnits: 0, availableUnits: 0, equipmentUnits: 0 },
  );
}

export function isStackableInventoryCategory(
  category: AssignableInventoryCategory,
) {
  return category === "potential_boost" || category === "rating_boost";
}

export function dailyRewardsToInventoryItems(
  rewards: readonly DailyRewardInventoryItem[],
): TeamInventoryItem[] {
  return groupDailyRewardInventoryItems(rewards).map((reward) => ({
    id: `daily-reward:${reward.key}`,
    sourceId: reward.id,
    catalogKey: reward.key,
    source: "daily_reward",
    category: getDailyRewardInventoryCategory(reward),
    name: reward.name,
    description: reward.description,
    effectSummary: reward.effectSummary,
    resalePrice: null,
    effectPayload: reward.payload,
    rarity: getDailyRewardInventoryRarity(reward.importance),
    quantity: reward.quantity,
    availableQuantity: reward.quantity,
    equippedQuantity: 0,
    pendingQuantity: 0,
    equippedRiderIds: [],
    pendingRiderIds: [],
    iconKey: reward.iconKey,
    imagePath: null,
    supplierName: null,
    equipmentSlot: null,
    isConsumable: true,
    acquiredAt: reward.acquiredAt,
    dailyReward: reward,
  }));
}

function getDailyRewardInventoryCategory(
  reward: DailyRewardInventoryItem,
): InventoryCategory {
  if (reward.effectKind === "rating_boost") return "rating_boost";
  if (reward.effectKind === "special_ability") return "special_ability";
  if (reward.effectKind === "injury_care") return "injury_care";
  return "other";
}

function getDailyRewardInventoryRarity(importance: number): InventoryRarity {
  if (importance >= 9) return "epic";
  if (importance >= 6) return "rare";
  if (importance >= 3) return "uncommon";
  return "common";
}
