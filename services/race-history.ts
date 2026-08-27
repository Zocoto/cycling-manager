import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type HistoricalRaceClassificationRow = {
  race_name: string;
  season_name: string;
  game_year: number;
  race_format: "one_day" | "stage_race";
  final_rank: number | null;
  status: HistoricalRaceClassificationEntry["status"];
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  team_name: string;
  total_time_ms: number | string | null;
  gap_to_winner_ms: number | string | null;
};

export type HistoricalRaceClassificationEntry = {
  rank: number | null;
  status:
    | "classified"
    | "did_not_start"
    | "did_not_finish"
    | "disqualified"
    | "outside_time_limit"
    | "withdrawn";
  riderId: string;
  riderName: string;
  teamName: string;
  totalTimeMs: number | null;
  gapToWinnerMs: number | null;
};

export type HistoricalRaceClassification = {
  raceName: string;
  seasonName: string;
  gameYear: number;
  raceFormat: "one_day" | "stage_race";
  entries: HistoricalRaceClassificationEntry[];
};

export async function getHistoricalRaceClassification({
  supabase,
  raceId,
  gameYear,
}: {
  supabase: SupabaseServerClient;
  raceId: string;
  gameYear: number;
}): Promise<HistoricalRaceClassification | null> {
  const { data, error } = await supabase.rpc(
    "get_race_historical_classification",
    {
      p_race_id: raceId,
      p_game_year: gameYear,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de charger le classement historique : ${error.message}`,
    );
  }

  const rows = (data as HistoricalRaceClassificationRow[] | null) ?? [];
  const first = rows[0];
  if (!first) return null;

  return {
    raceName: first.race_name,
    seasonName: first.season_name,
    gameYear: first.game_year,
    raceFormat: first.race_format,
    entries: rows.map((row) => ({
      rank: row.final_rank,
      status: row.status,
      riderId: row.rider_id,
      riderName: `${row.rider_first_name} ${row.rider_last_name}`,
      teamName: row.team_name,
      totalTimeMs:
        row.total_time_ms === null ? null : Number(row.total_time_ms),
      gapToWinnerMs:
        row.gap_to_winner_ms === null ? null : Number(row.gap_to_winner_ms),
    })),
  };
}
