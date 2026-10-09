import "server-only";
import { HALLOWEEN_EDITION } from "@/lib/game/halloween-event";
import { halloweenToInventoryItems } from "@/lib/game/halloween-inventory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getCurrentHalloweenInventory(authUserId: string) {
  const result = await createSupabaseAdminClient()
    .from("halloween_wallets")
    .select("inventory, cosmetics")
    .eq("edition_id", HALLOWEEN_EDITION)
    .eq("user_id", authUserId)
    .maybeSingle<{ inventory: Record<string, unknown>; cosmetics: Record<string, unknown> }>();
  if (result.error) throw new Error(`Impossible de charger vos objets Halloween : ${result.error.message}`);
  return halloweenToInventoryItems(result.data?.inventory, result.data?.cosmetics);
}
