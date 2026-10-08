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
  effect_payload: Record<string, unknown>;
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
  currency: string;
  scoutingRevealActiveUntil: string | null;
  items: TeamInventoryItem[];
  summary: ReturnType<typeof summarizeInventory>;
};

export async function getCurrentTeamInventoryOverview(
  authUserId: string,
): Promise<TeamInventoryOverview | null> {
  const equipmentOverview = await getCurrentTeamEquipmentOverview(authUserId);
  if (!equipmentOverview) return null;

  const admin = createSupabaseAdminClient();
  const [catalogResult, inventoryResult, teamSeasonResult] = await Promise.all([
    admin
      .from("inventory_catalog_items")
      .select(
        "id, item_key, name, category, rarity, description, effect_summary, effect_payload, icon_key, is_consumable",
      )
      .eq("status", "active")
      .returns<CatalogRow[]>(),
    admin
      .from("team_item_inventory")
      .select("inventory_item_id, quantity, acquired_at")
      .eq("team_season_id", equipmentOverview.teamSeasonId)
      .gt("quantity", 0)
      .returns<InventoryRow[]>(),
    admin
      .from("team_seasons")
      .select("scouting_reports_revealed_until")
      .eq("id", equipmentOverview.teamSeasonId)
      .maybeSingle<{ scouting_reports_revealed_until: string | null }>(),
  ]);

  assertQuery(catalogResult.error, "le catalogue d’objets");
  assertQuery(inventoryResult.error, "les objets possédés");
  assertQuery(teamSeasonResult.error, "l’effet de visibilité du scouting");

  const catalogById = new Map(
    (catalogResult.data ?? []).map((item) => [item.id, item]),
  );
  const genericItems = (inventoryResult.data ?? []).flatMap((inventory) => {
    const catalogItem = catalogById.get(inventory.inventory_item_id);
    if (!catalogItem) return [];

    return [
      {
        id: `item:${catalogItem.id}`,
        sourceId: catalogItem.id,
        catalogKey: catalogItem.item_key,
        source: "item",
        category: catalogItem.category,
        name: catalogItem.name,
        description: catalogItem.description,
        effectSummary: catalogItem.effect_summary,
        resalePrice: null,
        effectPayload: catalogItem.effect_payload,
        rarity: catalogItem.rarity,
        quantity: inventory.quantity,
        availableQuantity: inventory.quantity,
        equippedQuantity: 0,
        pendingQuantity: 0,
        equippedRiderIds: [],
        pendingRiderIds: [],
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
    .filter(
      (item) =>
        item.channel !== "equipment_partner" && item.ownedQuantity > 0,
    )
    .map(
      (item) =>
        ({
          id: `equipment:${item.id}`,
          sourceId: item.id,
          catalogKey: item.catalogKey,
          source: "equipment",
          category: "equipment",
          name: item.name,
          description: item.description,
          effectSummary: item.effectSummary,
          resalePrice: item.resalePrice,
          rarity: equipmentRarity(item.rarity),
          quantity: item.ownedQuantity,
          availableQuantity: item.availableQuantity,
          equippedQuantity: item.equippedQuantity,
          pendingQuantity: item.pendingQuantity,
          equippedRiderIds: equipmentOverview.assignments
            .filter((assignment) => assignment.equipmentItemId === item.id)
            .map((assignment) => assignment.riderId),
          pendingRiderIds: equipmentOverview.pendingAssignments
            .filter((assignment) => assignment.equipmentItemId === item.id)
            .map((assignment) => assignment.riderId),
          equippedAssignments: equipmentOverview.assignments
            .filter(assignment => assignment.equipmentItemId === item.id)
            .map(({ riderId, slot }) => ({ riderId, slot })),
          pendingAssignments: equipmentOverview.pendingAssignments
            .filter(assignment => assignment.equipmentItemId === item.id)
            .map(({ riderId, slot }) => ({ riderId, slot })),
          iconKey: "equipment",
          imagePath: item.imagePath,
          supplierName: item.supplierName,
          equipmentSlot: item.slot,
          isConsumable: false,
          acquiredAt: null,
        }) satisfies TeamInventoryItem,
    );

  const items = [...genericItems, ...equipmentItems].sort(
    (left, right) =>
      Number(right.availableQuantity > 0) -
        Number(left.availableQuantity > 0) ||
      left.name.localeCompare(right.name, "fr"),
  );
  const rawScoutingRevealActiveUntil =
    teamSeasonResult.data?.scouting_reports_revealed_until ?? null;
  const scoutingRevealActiveUntil =
    rawScoutingRevealActiveUntil &&
    Date.parse(rawScoutingRevealActiveUntil) > Date.now()
      ? rawScoutingRevealActiveUntil
      : null;

  return {
    teamName: equipmentOverview.teamName,
    seasonName: equipmentOverview.seasonName,
    currency: equipmentOverview.currency,
    scoutingRevealActiveUntil,
    items,
    summary: summarizeInventory(items),
  };
}

function equipmentRarity(
  rarity: "common" | "performance" | "premium",
): InventoryRarity {
  if (rarity === "premium") return "epic";
  if (rarity === "performance") return "rare";
  return "common";
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
