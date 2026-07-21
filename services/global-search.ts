import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  type GlobalSearchResult,
} from "@/lib/game/global-search";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";

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
  const currentResults = await enrichCurrentTeamDivisions(
    await searchCurrentDirectory(
      supabase,
      query,
      normalizedLimit
    )
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

  return enrichCurrentTeamDivisions(
    limitResultsPerCategory(
      [...currentResults, ...historicalTeams],
      normalizedLimit
    )
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

async function enrichCurrentTeamDivisions(
  results: GlobalSearchResult[]
): Promise<GlobalSearchResult[]> {
  const teamIds = [
    ...new Set(
      results
        .map((result) => result.team_id)
        .filter((teamId): teamId is string => Boolean(teamId))
    ),
  ];

  if (teamIds.length === 0) {
    return results.map((result) => ({
      ...result,
      division_code: null,
      division_name: null,
    }));
  }

  const supabase = createSupabaseAdminClient();
  const { data: activeSeason, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (seasonError || !activeSeason) {
    throw new Error(
      `Impossible de charger la saison des divisions : ${seasonError?.message ?? "saison active introuvable"}`
    );
  }

  const { data: teamSeasons, error: teamSeasonsError } = await supabase
    .from("team_seasons")
    .select("team_id, division_id")
    .eq("season_id", activeSeason.id)
    .in("team_id", teamIds)
    .returns<Array<{ team_id: string; division_id: string | null }>>();

  if (teamSeasonsError) {
    throw new Error(
      `Impossible de charger les divisions des équipes : ${teamSeasonsError.message}`
    );
  }

  const divisionIds = [
    ...new Set(
      (teamSeasons ?? [])
        .map((teamSeason) => teamSeason.division_id)
        .filter((divisionId): divisionId is string => Boolean(divisionId))
    ),
  ];
  const { data: divisions, error: divisionsError } = divisionIds.length
    ? await supabase
        .from("divisions")
        .select("id, code")
        .in("id", divisionIds)
        .returns<Array<{ id: string; code: string }>>()
    : { data: [] as Array<{ id: string; code: string }>, error: null };

  if (divisionsError) {
    throw new Error(
      `Impossible de charger le référentiel des divisions : ${divisionsError.message}`
    );
  }

  const divisionCodeById = new Map(
    (divisions ?? []).map((division) => [division.id, division.code])
  );
  const divisionCodeByTeamId = new Map(
    (teamSeasons ?? []).map((teamSeason) => [
      teamSeason.team_id,
      normalizeTeamDivisionCode(
        teamSeason.division_id
          ? divisionCodeById.get(teamSeason.division_id)
          : null
      ),
    ])
  );

  return results.map((result) => {
    if (!result.team_id) {
      return { ...result, division_code: null, division_name: null };
    }

    const divisionCode = divisionCodeByTeamId.get(result.team_id) ?? "amateur";
    return {
      ...result,
      division_code: divisionCode,
      division_name: getTeamDivisionLabel(divisionCode),
    };
  });
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
