import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicTeamSeasonHistoryEntry = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  displayName: string;
  points: number;
  finalRank: number | null;
  status: string;
};

type TeamSeasonRow = {
  season_id: string;
  display_name: string;
  points: number;
  final_rank: number | null;
  status: string;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
};

export async function getPublicTeamSeasonHistory(
  teamId: string
): Promise<PublicTeamSeasonHistoryEntry[]> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data: teamSeasons, error: teamSeasonsError } = await supabase
    .from("team_seasons")
    .select("season_id, display_name, points, final_rank, status")
    .eq("team_id", normalizedTeamId)
    .order("created_at", { ascending: false })
    .returns<TeamSeasonRow[]>();

  if (teamSeasonsError) {
    throw new Error(
      `Impossible de charger l’historique de l’équipe : ${teamSeasonsError.message}`
    );
  }

  if (!teamSeasons || teamSeasons.length === 0) {
    return [];
  }

  const seasonIds = [...new Set(teamSeasons.map((entry) => entry.season_id))];
  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("id, name, game_year")
    .in("id", seasonIds)
    .returns<SeasonRow[]>();

  if (seasonsError) {
    throw new Error(
      `Impossible de charger les saisons de l’équipe : ${seasonsError.message}`
    );
  }

  const seasonsById = new Map(
    (seasons ?? []).map((season) => [season.id, season] as const)
  );

  return teamSeasons
    .map((entry) => {
      const season = seasonsById.get(entry.season_id);

      if (!season) {
        return null;
      }

      return {
        seasonId: entry.season_id,
        seasonName: season.name,
        gameYear: season.game_year,
        displayName: entry.display_name,
        points: entry.points,
        finalRank: entry.final_rank,
        status: entry.status,
      } satisfies PublicTeamSeasonHistoryEntry;
    })
    .filter((entry): entry is PublicTeamSeasonHistoryEntry => entry !== null)
    .sort((left, right) => right.gameYear - left.gameYear);
}
