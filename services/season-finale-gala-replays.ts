import "server-only";

import { SEASON_FINALE_GALA_EVENT_KEY } from "@/lib/game/season-finale-gala";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type GalaEventRow = {
  id: string;
};

type GalaReplayRow = {
  id: string;
  group_number: number;
  youtube_video_id: string;
  winner_rider_id: string;
  winner_team_id: string;
  winner_rider_name: string;
  winner_team_name: string;
  published_at: string;
};

export type SeasonFinaleGalaReplayResult = {
  id: string;
  groupNumber: number;
  youtubeVideoId: string;
  winnerRiderId: string;
  winnerTeamId: string;
  winnerRiderName: string;
  winnerTeamName: string;
  publishedAt: string;
};

export async function getSeasonFinaleGalaReplays(
  supabase: SupabaseServerClient,
  sourceGameYear: number,
): Promise<SeasonFinaleGalaReplayResult[]> {
  const eventResult = await supabase
    .from("pcm_gala_events")
    .select("id, seasons!inner(game_year)")
    .eq("event_key", SEASON_FINALE_GALA_EVENT_KEY)
    .eq("seasons.game_year", sourceGameYear)
    .limit(1)
    .maybeSingle<GalaEventRow>();

  if (eventResult.error) {
    throw new Error(
      `Impossible d’identifier le gala de la saison ${sourceGameYear} : ${eventResult.error.message}`,
    );
  }
  if (!eventResult.data) return [];

  const replayResult = await supabase
    .from("pcm_gala_group_replays")
    .select("id, group_number, youtube_video_id, winner_rider_id, winner_team_id, winner_rider_name, winner_team_name, published_at")
    .eq("gala_event_id", eventResult.data.id)
    .lte("published_at", new Date().toISOString())
    .order("group_number", { ascending: true })
    .returns<GalaReplayRow[]>();

  if (replayResult.error) {
    throw new Error(
      `Impossible de charger les vidéos du gala : ${replayResult.error.message}`,
    );
  }

  return (replayResult.data ?? [])
    .filter((row) => /^[A-Za-z0-9_-]{11}$/.test(row.youtube_video_id))
    .map((row) => ({
      id: row.id,
      groupNumber: row.group_number,
      youtubeVideoId: row.youtube_video_id,
      winnerRiderId: row.winner_rider_id,
      winnerTeamId: row.winner_team_id,
      winnerRiderName: row.winner_rider_name,
      winnerTeamName: row.winner_team_name,
      publishedAt: row.published_at,
    }));
}
