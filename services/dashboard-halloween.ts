import "server-only";
import { cache } from "react";
import { HALLOWEEN_EDITION, HALLOWEEN_SHOP_END } from "@/lib/game/halloween-event";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Shared by the existing banner and the enriched assistant in the same render.
// No extra round trip, and optional event data never blocks essential alerts.
export const getDashboardHalloweenEdition = cache(async (): Promise<{
  id: string;
  shopEndsAt: string;
} | null> => {
  // The seasonal announcement is finished. Archived inventory has its own reader.
  if (Date.now() >= Date.parse(HALLOWEEN_SHOP_END)) return null;

  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("halloween_editions")
      .select("id,shop_ends_at")
      .eq("id", HALLOWEEN_EDITION)
      .eq("enabled", true)
      .lte("starts_at", "now")
      .gt("shop_ends_at", "now")
      .abortSignal(AbortSignal.timeout(3000))
      .maybeSingle<{ id: string; shop_ends_at: string }>();
    if (error || !data || !Number.isFinite(Date.parse(data.shop_ends_at))) return null;
    return { id: data.id, shopEndsAt: data.shop_ends_at };
  } catch {
    return null;
  }
});
