import "server-only";
import type { SeasonDraftView } from "@/lib/game/season-draft";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSeasonDraftView(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, full = true) {
  const { data, error } = await supabase.rpc("get_season_draft_view", { p_full: full }).abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error("Impossible de charger la draft : " + error.message);
  return data as SeasonDraftView;
}
