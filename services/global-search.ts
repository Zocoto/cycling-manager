import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  type GlobalSearchResult,
} from "@/lib/game/global-search";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const DEFAULT_RESULTS_PER_CATEGORY = 8;
const MAX_RESULTS_PER_CATEGORY = 20;

export async function searchGameDirectory(
  supabase: SupabaseServerClient,
  query: string,
  limitPerCategory = DEFAULT_RESULTS_PER_CATEGORY
): Promise<GlobalSearchResult[]> {
  if (query.length < GLOBAL_SEARCH_MIN_LENGTH) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "search_game_directory",
    {
      p_query: query,
      p_limit_per_category: Math.min(
        MAX_RESULTS_PER_CATEGORY,
        Math.max(1, Math.floor(limitPerCategory))
      ),
    }
  );

  if (error) {
    throw new Error(
      `Impossible d’effectuer la recherche : ${error.message}`
    );
  }

  return (data ?? []) as GlobalSearchResult[];
}
