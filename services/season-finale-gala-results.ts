import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { SEASON_FINALE_GALA_RESULTS_EVENT_ID } from "@/lib/game/season-finale-gala-results-data";

export type SeasonFinaleGalaPublishedReward = {
  group_number: number;
  rank: number;
  rider_id: string | null;
  rider_name: string;
  team_id: string | null;
  team_name: string;
  manager_name: string;
  item_name: string;
  summary: string;
  allocated_at: string | null;
};

export async function getSeasonFinaleGalaPublishedRewards(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<SeasonFinaleGalaPublishedReward[] | null> {
  const result = await supabase.rpc("get_pcm_gala_published_rewards", {
    p_event_id: SEASON_FINALE_GALA_RESULTS_EVENT_ID,
  });
  if (result.error) {
    console.error("gala_rewards_read_failed", { code: result.error.code });
    return null;
  }
  return (result.data ?? []) as SeasonFinaleGalaPublishedReward[];
}
