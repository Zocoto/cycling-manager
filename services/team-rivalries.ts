import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RivalryRow = {
  rivalry_id: string;
  season_id: string;
  season_name: string;
  game_year: number;
  status: "active" | "completed" | "cancelled";
  own_team_id: string;
  team_a_id: string;
  team_a_name: string;
  team_a_director_name: string;
  team_a_wins: number;
  team_b_id: string;
  team_b_name: string;
  team_b_director_name: string;
  team_b_wins: number;
  draws: number;
  shared_races: number;
  intensity: number;
  winner_team_id: string | null;
  own_reputation_delta: number | null;
  settled_at: string | null;
};

export type TeamRivalry = {
  id: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  status: RivalryRow["status"];
  ownTeamId: string;
  teamA: { id: string; name: string; directorName: string; wins: number };
  teamB: { id: string; name: string; directorName: string; wins: number };
  draws: number;
  sharedRaces: number;
  intensity: number;
  winnerTeamId: string | null;
  ownReputationDelta: number | null;
  settledAt: string | null;
};

export async function getCurrentTeamRivalries(
  supabase: SupabaseServerClient,
): Promise<TeamRivalry[]> {
  const { data, error } = await supabase.rpc("get_current_team_rivalries");
  if (error) throw new Error(`Impossible de charger les rivalités : ${error.message}`);
  return ((data as RivalryRow[] | null) ?? []).map((row) => ({
    id: row.rivalry_id,
    seasonId: row.season_id,
    seasonName: row.season_name,
    gameYear: row.game_year,
    status: row.status,
    ownTeamId: row.own_team_id,
    teamA: { id: row.team_a_id, name: row.team_a_name, directorName: row.team_a_director_name, wins: row.team_a_wins },
    teamB: { id: row.team_b_id, name: row.team_b_name, directorName: row.team_b_director_name, wins: row.team_b_wins },
    draws: row.draws,
    sharedRaces: row.shared_races,
    intensity: row.intensity,
    winnerTeamId: row.winner_team_id,
    ownReputationDelta: row.own_reputation_delta,
    settledAt: row.settled_at,
  }));
}
