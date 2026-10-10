import "server-only";
import { HALLOWEEN_EDITION } from "@/lib/game/halloween-event";
import { halloweenAvatarWardrobe } from "@/lib/game/halloween-avatar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Personal, indexed read; independent of the event's opening dates. */
export async function getHalloweenAvatarWardrobe(authUserId: string) {
  const { data, error } = await createSupabaseAdminClient().from("halloween_wallets")
    .select("inventory, cosmetics").eq("edition_id", HALLOWEEN_EDITION).eq("user_id", authUserId)
    .maybeSingle<{ inventory: Record<string, unknown>; cosmetics: Record<string, unknown> }>();
  if (error) throw new Error("Impossible de charger vos accessoires Halloween.");
  return halloweenAvatarWardrobe(data?.inventory, data?.cosmetics);
}
