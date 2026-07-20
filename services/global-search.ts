import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  type GlobalSearchResult,
} from "@/lib/game/global-search";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const DEFAULT_RESULTS_PER_CATEGORY = 8;
const MAX_RESULTS_PER_CATEGORY = 20;

type HistoricalTeamNameRow = {
  team_id: string;
};

export async function searchGameDirectory(
  supabase: SupabaseServerClient,
  query: string,
  limitPerCategory = DEFAULT_RESULTS_PER_CATEGORY
): Promise<GlobalSearchResult[]> {
  if (query.length < GLOBAL_SEARCH_MIN_LENGTH) {
    return [];
  }

  const normalizedLimit = Math.min(
    MAX_RESULTS_PER_CATEGORY,
    Math.max(1, Math.floor(limitPerCategory))
  );
  const currentResults = await searchCurrentDirectory(
    supabase,
    query,
    normalizedLimit
  );
  const historicalTeamIds = await findTeamsByHistoricalName(
    query,
    normalizedLimit
  );
  const currentTeamIds = new Set(
    currentResults
      .filter((result) => result.result_type === "team")
      .map((result) => result.entity_id)
  );
  const missingHistoricalTeamIds = historicalTeamIds.filter(
    (teamId) => !currentTeamIds.has(teamId)
  );

  if (missingHistoricalTeamIds.length === 0) {
    return currentResults;
  }

  const historicalResults = await Promise.all(
    missingHistoricalTeamIds.map((teamId) =>
      searchCurrentDirectory(supabase, teamId, 1)
    )
  );
  const historicalTeams = historicalResults
    .flat()
    .filter((result) => result.result_type === "team");

  return limitResultsPerCategory(
    [...currentResults, ...historicalTeams],
    normalizedLimit
  );
}

async function searchCurrentDirectory(
  supabase: SupabaseServerClient,
  query: string,
  limitPerCategory: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase.rpc("search_game_directory", {
    p_query: query,
    p_limit_per_category: limitPerCategory,
  });

  if (error) {
    throw new Error(
      `Impossible d’effectuer la recherche : ${error.message}`
    );
  }

  return (data ?? []) as GlobalSearchResult[];
}

async function findTeamsByHistoricalName(
  query: string,
  limit: number
): Promise<string[]> {
  const normalizedQuery = query
    .trim()
    .replace(/[%_]/g, "")
    .replace(/\s+/g, " ");

  if (normalizedQuery.length < GLOBAL_SEARCH_MIN_LENGTH) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_seasons")
    .select("team_id")
    .ilike("display_name", `%${normalizedQuery}%`)
    .order("created_at", { ascending: false })
    .limit(limit * 3)
    .returns<HistoricalTeamNameRow[]>();

  if (error) {
    throw new Error(
      `Impossible de rechercher les anciens noms d’équipe : ${error.message}`
    );
  }

  return [...new Set((data ?? []).map((entry) => entry.team_id))].slice(
    0,
    limit
  );
}

function limitResultsPerCategory(
  results: GlobalSearchResult[],
  limit: number
): GlobalSearchResult[] {
  const counts = new Map<string, number>();
  const seenResults = new Set<string>();

  return results.filter((result) => {
    const resultKey = `${result.result_type}:${result.entity_id}`;
    const categoryCount = counts.get(result.result_type) ?? 0;

    if (seenResults.has(resultKey) || categoryCount >= limit) {
      return false;
    }

    seenResults.add(resultKey);
    counts.set(result.result_type, categoryCount + 1);
    return true;
  });
}
