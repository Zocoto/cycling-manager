import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Shared by the existing banner and the enriched assistant in the same render.
// No extra round trip, and optional event data never blocks essential alerts.
export const getDashboardHalloweenEdition = cache(async (): Promise<{
  id: string;
  shopEndsAt: string;
} | null> => {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("halloween_editions")
      .select("id,shop_ends_at")
      .eq("id", "halloween-2026")
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
