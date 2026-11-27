import "server-only";
import { christmasAvatarWardrobe } from "@/lib/game/christmas-avatar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Permanent ownership, one indexed read only when opening the profile editor. */
export async function getChristmasAvatarWardrobe(authUserId: string) {
  const { data, error } = await createSupabaseAdminClient().from("christmas_wallets")
    .select("inventory, cosmetics").eq("edition_id", "christmas-2026").eq("user_id", authUserId)
    .maybeSingle<{ inventory: Record<string, unknown>; cosmetics: Record<string, unknown> }>();
  if (error) throw new Error("Impossible de charger vos accessoires de Noël.");
  return christmasAvatarWardrobe(data?.inventory, data?.cosmetics);
}
