import "server-only";

import type { TeamDivisionCode } from "@/lib/game/economy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";

export type PublicTeamSeasonHistoryEntry = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  displayName: string;
  points: number;
  finalRank: number | null;
  divisionCode: TeamDivisionCode;
  divisionName: string;
  status: string;
};

type TeamSeasonRow = {
  season_id: string;
  display_name: string;
  points: number;
  final_rank: number | null;
  division_id: string | null;
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
    .select("season_id, display_name, points, final_rank, division_id, status")
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
  const divisionIds = [
    ...new Set(
      teamSeasons
        .map((entry) => entry.division_id)
        .filter((divisionId): divisionId is string => Boolean(divisionId))
    ),
  ];
  const [seasonsResult, divisionsResult] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, game_year")
      .in("id", seasonIds)
      .returns<SeasonRow[]>(),
    divisionIds.length
      ? supabase
          .from("divisions")
          .select("id, code")
          .in("id", divisionIds)
          .returns<Array<{ id: string; code: string }>>()
      : Promise.resolve({
          data: [] as Array<{ id: string; code: string }>,
          error: null,
        }),
  ]);

  if (seasonsResult.error) {
    throw new Error(
      `Impossible de charger les saisons de l’équipe : ${seasonsResult.error.message}`
    );
  }

  if (divisionsResult.error) {
    throw new Error(
      `Impossible de charger les divisions de l’équipe : ${divisionsResult.error.message}`
    );
  }

  const seasonsById = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season] as const)
  );
  const divisionCodeById = new Map(
    (divisionsResult.data ?? []).map((division) => [division.id, division.code])
  );

  return teamSeasons
    .map((entry) => {
      const season = seasonsById.get(entry.season_id);

      if (!season) {
        return null;
      }

      const divisionCode = normalizeTeamDivisionCode(
        entry.division_id ? divisionCodeById.get(entry.division_id) : null
      );

      return {
        seasonId: entry.season_id,
        seasonName: season.name,
        gameYear: season.game_year,
        displayName: entry.display_name,
        points: entry.points,
        finalRank: entry.final_rank,
        divisionCode,
        divisionName: getTeamDivisionLabel(divisionCode),
        status: entry.status,
      } satisfies PublicTeamSeasonHistoryEntry;
    })
    .filter((entry): entry is PublicTeamSeasonHistoryEntry => entry !== null)
    .sort((left, right) => right.gameYear - left.gameYear);
}
