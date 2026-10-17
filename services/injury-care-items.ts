import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupInjuryCareItems, type InjuryCareItem } from "@/lib/game/injury-care";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectPaginatedRows } from "@/lib/supabase/pagination";
import { getCurrentHalloweenInventory } from "@/services/halloween-inventory";

type CareCatalog = { name: string; effect_payload: { recoveryHours?: unknown } };
type StockRow = { quantity: number; inventory_catalog_items: CareCatalog & { id: string; item_key: string } };
type GiftRow = { id: string; reward_key: string; daily_reward_catalog: CareCatalog };

// teamSeasonId comes from the authenticated health overview. Daily gifts use
// the authenticated client and its existing owner-only row-level policy.
export async function getCurrentInjuryCareItems({ supabase, authUserId, teamSeasonId, gameYear }: {
  supabase: SupabaseClient; authUserId: string; teamSeasonId: string; gameYear: number;
}): Promise<InjuryCareItem[]> {
  const admin = createSupabaseAdminClient();
  const [stock, gifts, halloween] = await Promise.all([
    collectPaginatedRows<StockRow, { message: string }>({ fetchPage: async (from, to) =>
      await admin.from("team_item_inventory")
        .select("quantity, inventory_catalog_items!inner(id, item_key, name, effect_payload)")
        .eq("team_season_id", teamSeasonId).gt("quantity", 0)
        .eq("inventory_catalog_items.category", "injury_care")
        .eq("inventory_catalog_items.status", "active")
        .eq("inventory_catalog_items.is_consumable", true)
        .eq("inventory_catalog_items.effect_payload->>effectKind", "injury_care")
        .order("id").range(from, to).returns<StockRow[]>(),
    }),
    collectPaginatedRows<GiftRow, { message: string }>({ fetchPage: async (from, to) =>
      await supabase.from("daily_reward_inventory")
        .select("id, reward_key, daily_reward_catalog!inner(name, effect_payload)")
        .eq("status", "available").gte("expires_after_game_year", gameYear)
        .eq("daily_reward_catalog.effect_kind", "injury_care")
        .eq("daily_reward_catalog.is_active", true)
        .order("acquired_at").order("id").range(from, to).returns<GiftRow[]>(),
    }),
    getCurrentHalloweenInventory(authUserId),
  ]);
  if (stock.error || gifts.error) throw new Error("Impossible de charger les objets de soin disponibles.");
  return groupInjuryCareItems([
    ...stock.data.map(row => ({ inventoryId: row.inventory_catalog_items.id,
      catalogKey: row.inventory_catalog_items.item_key, name: row.inventory_catalog_items.name,
      recoveryHours: Number(row.inventory_catalog_items.effect_payload.recoveryHours), quantity: row.quantity })),
    ...gifts.data.map(row => ({ inventoryId: row.id, catalogKey: row.reward_key, name: row.daily_reward_catalog.name,
      recoveryHours: Number(row.daily_reward_catalog.effect_payload.recoveryHours), quantity: 1 })),
    ...halloween.flatMap((item): InjuryCareItem[] => item.sourceId === "mummy-bandage" || item.sourceId === "mummy-resurrection"
      ? [{ inventoryId: `halloween:${item.sourceId}`, catalogKey: item.sourceId, name: item.name,
        recoveryHours: item.sourceId === "mummy-bandage" ? 12 : 0, quantity: item.availableQuantity,
        halloweenItem: item.sourceId, fullRecovery: item.sourceId === "mummy-resurrection" }]
      : []),
  ]);
}
