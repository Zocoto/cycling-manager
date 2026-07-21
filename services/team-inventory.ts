import "server-only";

import {
  summarizeInventory,
  type InventoryRarity,
  type StoredInventoryCategory,
  type TeamInventoryItem,
} from "@/lib/game/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamEquipmentOverview } from "@/services/team-equipment";

type CatalogRow = {
  id: string;
  item_key: string;
  name: string;
  category: StoredInventoryCategory;
  rarity: InventoryRarity;
  description: string;
  effect_summary: string;
  icon_key: string;
  is_consumable: boolean;
};

type InventoryRow = {
  inventory_item_id: string;
  quantity: number;
  acquired_at: string;
};

export type TeamInventoryOverview = {
  teamName: string;
  seasonName: string;
  items: TeamInventoryItem[];
  summary: ReturnType<typeof summarizeInventory>;
};

export async function getCurrentTeamInventoryOverview(
  authUserId: string
): Promise<TeamInventoryOverview | null> {
  const equipmentOverview = await getCurrentTeamEquipmentOverview(authUserId);
  if (!equipmentOverview) return null;

  const admin = createSupabaseAdminClient();
  const [catalogResult, inventoryResult] = await Promise.all([
    admin
      .from("inventory_catalog_items")
      .select(
        "id, item_key, name, category, rarity, description, effect_summary, icon_key, is_consumable"
      )
      .eq("status", "active")
      .returns<CatalogRow[]>(),
    admin
      .from("team_item_inventory")
      .select("inventory_item_id, quantity, acquired_at")
      .eq("team_season_id", equipmentOverview.teamSeasonId)
      .gt("quantity", 0)
      .returns<InventoryRow[]>(),
  ]);

  assertQuery(catalogResult.error, "le catalogue d’objets");
  assertQuery(inventoryResult.error, "les objets possédés");

  const catalogById = new Map(
    (catalogResult.data ?? []).map((item) => [item.id, item])
  );
  const genericItems = (inventoryResult.data ?? []).flatMap((inventory) => {
    const catalogItem = catalogById.get(inventory.inventory_item_id);
    if (!catalogItem) return [];

    return [
      {
        id: `item:${catalogItem.id}`,
        sourceId: catalogItem.id,
        source: "item",
        category: catalogItem.category,
        name: catalogItem.name,
        description: catalogItem.description,
        effectSummary: catalogItem.effect_summary,
        rarity: catalogItem.rarity,
        quantity: inventory.quantity,
        availableQuantity: inventory.quantity,
        equippedQuantity: 0,
        pendingQuantity: 0,
        iconKey: catalogItem.icon_key,
        imagePath: null,
        supplierName: null,
        equipmentSlot: null,
        isConsumable: catalogItem.is_consumable,
        acquiredAt: inventory.acquired_at,
      } satisfies TeamInventoryItem,
    ];
  });

  const equipmentItems = equipmentOverview.catalog
    .filter((item) => item.ownedQuantity > 0)
    .map(
      (item) =>
        ({
          id: `equipment:${item.id}`,
          sourceId: item.id,
          source: "equipment",
          category: "equipment",
          name: item.name,
          description: item.description,
          effectSummary: item.effectSummary,
          rarity: equipmentRarity(item.rarity),
          quantity: item.ownedQuantity,
          availableQuantity: item.availableQuantity,
          equippedQuantity: item.equippedQuantity,
          pendingQuantity: item.pendingQuantity,
          iconKey: "equipment",
          imagePath: item.imagePath,
          supplierName: item.supplierName,
          equipmentSlot: item.slot,
          isConsumable: false,
          acquiredAt: null,
        }) satisfies TeamInventoryItem
    );

  const items = [...genericItems, ...equipmentItems].sort(
    (left, right) =>
      Number(right.availableQuantity > 0) - Number(left.availableQuantity > 0) ||
      left.name.localeCompare(right.name, "fr")
  );

  return {
    teamName: equipmentOverview.teamName,
    seasonName: equipmentOverview.seasonName,
    items,
    summary: summarizeInventory(items),
  };
}

function equipmentRarity(
  rarity: "common" | "performance" | "premium"
): InventoryRarity {
  if (rarity === "premium") return "epic";
  if (rarity === "performance") return "rare";
  return "common";
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
