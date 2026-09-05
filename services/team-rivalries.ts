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
  team_a_reputation_delta: number | null;
  team_b_id: string;
  team_b_name: string;
  team_b_director_name: string;
  team_b_wins: number;
  team_b_reputation_delta: number | null;
  draws: number;
  shared_races: number;
  intensity: number;
  winner_team_id: string | null;
  pairing_reason: string;
  team_a_pairing_rank: number | null;
  team_b_pairing_rank: number | null;
  events: RivalryEventRow[] | null;
  settled_at: string | null;
};

type RivalryEventRow = {
  id: string;
  raceEditionId: string;
  raceName: string;
  raceSlug: string;
  teamARank: number;
  teamBRank: number;
  teamAPoints: number;
  teamBPoints: number;
  isDraw: boolean;
  winnerTeamId: string | null;
  intensityDelta: number;
  teamAScoreAfter: number;
  teamBScoreAfter: number;
  drawsAfter: number;
  intensityAfter: number;
  decidedAt: string;
};

export type TeamRivalryEvent = RivalryEventRow;

export type TeamRivalry = {
  id: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  status: RivalryRow["status"];
  ownTeamId: string;
  teamA: {
    id: string;
    name: string;
    directorName: string;
    wins: number;
    reputationDelta: number | null;
    pairingRank: number | null;
  };
  teamB: {
    id: string;
    name: string;
    directorName: string;
    wins: number;
    reputationDelta: number | null;
    pairingRank: number | null;
  };
  draws: number;
  sharedRaces: number;
  intensity: number;
  winnerTeamId: string | null;
  pairingReason: string;
  events: TeamRivalryEvent[];
  settledAt: string | null;
};

export async function getCurrentTeamRivalries(
  supabase: SupabaseServerClient,
): Promise<TeamRivalry[]> {
  const { data, error } = await supabase.rpc("get_current_team_rivalry_dossiers");
  if (error) throw new Error(`Impossible de charger les rivalités : ${error.message}`);
  return ((data as RivalryRow[] | null) ?? []).map((row) => ({
    id: row.rivalry_id,
    seasonId: row.season_id,
    seasonName: row.season_name,
    gameYear: row.game_year,
    status: row.status,
    ownTeamId: row.own_team_id,
    teamA: {
      id: row.team_a_id,
      name: row.team_a_name,
      directorName: row.team_a_director_name,
      wins: row.team_a_wins,
      reputationDelta: row.team_a_reputation_delta,
      pairingRank: row.team_a_pairing_rank,
    },
    teamB: {
      id: row.team_b_id,
      name: row.team_b_name,
      directorName: row.team_b_director_name,
      wins: row.team_b_wins,
      reputationDelta: row.team_b_reputation_delta,
      pairingRank: row.team_b_pairing_rank,
    },
    draws: row.draws,
    sharedRaces: row.shared_races,
    intensity: row.intensity,
    winnerTeamId: row.winner_team_id,
    pairingReason: row.pairing_reason,
    events: Array.isArray(row.events) ? row.events : [],
    settledAt: row.settled_at,
  }));
}
