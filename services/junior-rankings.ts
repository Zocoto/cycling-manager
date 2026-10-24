import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectPaginatedRows } from "@/lib/supabase/pagination";

export type JuniorRankingView = "equipes" | "individuel" | "nations";

export type JuniorRankingEntry = {
  rank: number;
  entityKey: string;
  academyRiderId: string | null;
  developmentTeamId: string | null;
  displayName: string;
  secondaryName: string | null;
  countryCode: string | null;
  points: number;
  wins: number;
  podiums: number;
  raceCount: number;
  rankedRiderCount: number | null;
};

export type JuniorRankings = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  enabled: boolean;
  view: JuniorRankingView;
  entries: JuniorRankingEntry[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalEntries: number;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
};

type RankingRow = {
  entity_key: string;
  academy_rider_id: string | null;
  development_team_id: string | null;
  display_name: string;
  secondary_name: string | null;
  country_code: string | null;
  points: number;
  wins: number;
  podiums: number;
  race_count: number;
};

type RankedRiderRow = Pick<RankingRow, "entity_key" | "academy_rider_id" | "development_team_id">;

const PAGE_SIZE = 50;

const getCachedJuniorRankings = unstable_cache(
  loadJuniorRankings,
  ["junior-rankings-s3-player-teams-distinct-riders-v3"],
  { revalidate: 30, tags: ["junior-rankings"] },
);

export async function getJuniorRankings(
  view: JuniorRankingView,
  requestedPage = 1,
): Promise<JuniorRankings | null> {
  return getCachedJuniorRankings(view, Math.max(1, Math.floor(requestedPage)));
}

async function loadJuniorRankings(
  view: JuniorRankingView,
  requestedPage: number,
): Promise<JuniorRankings | null> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();
  assertQuery(seasonResult.error, "la saison des classements juniors");
  const season = seasonResult.data;
  if (!season) return null;

  const entityType = view === "equipes" ? "team" : view === "nations" ? "nation" : "individual";
  if (season.game_year < 3) {
    return {
      seasonId: season.id,
      seasonName: season.name,
      gameYear: season.game_year,
      enabled: false,
      view,
      entries: [],
      page: 1,
      pageSize: PAGE_SIZE,
      pageCount: 1,
      totalEntries: 0,
    };
  }

  let countQuery = admin
    .from("development_ranking_entries")
    .select("id", { count: "exact", head: true })
    .eq("season_id", season.id)
    .eq("entity_type", entityType);
  // Filler AI teams have no development team. Filter before counting/paging,
  // without changing stored race results or individual/nation rankings.
  if (view === "equipes") countQuery = countQuery.not("development_team_id", "is", null);
  const countResult = await countQuery;
  assertQuery(countResult.error, "le volume du classement junior");
  const totalEntries = countResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  let rowsQuery = admin
    .from("development_ranking_entries")
    .select(
      "entity_key, academy_rider_id, development_team_id, display_name, secondary_name, country_code, points, wins, podiums, race_count",
    )
    .eq("season_id", season.id)
    .eq("entity_type", entityType);
  if (view === "equipes") rowsQuery = rowsQuery.not("development_team_id", "is", null);
  const rowsResult = await rowsQuery
    .order("points", { ascending: false })
    .order("wins", { ascending: false })
    .order("display_name", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)
    .returns<RankingRow[]>();
  assertQuery(rowsResult.error, "le classement junior");

  const rows = rowsResult.data ?? [];
  const rankedRidersByTeam = new Map<string, Set<string>>();
  if (view === "equipes" && rows.length) {
    // Count classified people, not the sum of their race participations.
    // Only load identities for this page (at most 50 teams), never race results
    // or a query per team. Pagination avoids PostgREST's 1,000-row truncation.
    const teamIds = [...new Set(rows.flatMap(row => row.development_team_id ? [row.development_team_id] : []))];
    const ridersResult = await collectPaginatedRows<RankedRiderRow, { message: string }>({
      fetchPage: async (from, to) => admin
        .from("development_ranking_entries")
        .select("entity_key, academy_rider_id, development_team_id")
        .eq("season_id", season.id)
        .eq("entity_type", "individual")
        .in("development_team_id", teamIds)
        .order("entity_key", { ascending: true })
        .range(from, to)
        .abortSignal(AbortSignal.timeout(3000))
        .returns<RankedRiderRow[]>(),
    });
    assertQuery(ridersResult.error, "le nombre de juniors classés");
    for (const rider of ridersResult.data) {
      if (!rider.development_team_id) continue;
      const identities = rankedRidersByTeam.get(rider.development_team_id) ?? new Set<string>();
      identities.add(rider.academy_rider_id ?? rider.entity_key);
      rankedRidersByTeam.set(rider.development_team_id, identities);
    }
  }

  return {
    seasonId: season.id,
    seasonName: season.name,
    gameYear: season.game_year,
    enabled: true,
    view,
    entries: rows.map((row, index) => ({
      rank: offset + index + 1,
      entityKey: row.entity_key,
      academyRiderId: row.academy_rider_id,
      developmentTeamId: row.development_team_id,
      displayName: row.display_name,
      secondaryName: row.secondary_name,
      countryCode: row.country_code,
      points: Number(row.points),
      wins: Number(row.wins),
      podiums: Number(row.podiums),
      raceCount: Number(row.race_count),
      rankedRiderCount: view === "equipes" ? (rankedRidersByTeam.get(row.development_team_id ?? "")?.size ?? 0) : null,
    })),
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    totalEntries,
  };
}

function assertQuery(
  error: { message: string } | null | undefined,
  label: string,
) {
  if (error) throw new Error(`Impossible de charger ${label} : ${error.message}`);
}
