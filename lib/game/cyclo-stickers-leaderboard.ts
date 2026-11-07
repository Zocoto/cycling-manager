import type { SupabaseClient } from "@supabase/supabase-js";

export type StickerAlbumLeaderboardEntry = {
  rank: number;
  displayName: string;
  pastedCount: number;
  isViewer: boolean;
};

export type StickerAlbumLeaderboard = {
  entries: StickerAlbumLeaderboardEntry[];
  viewer: StickerAlbumLeaderboardEntry | null;
};

export async function getCycloStickersLeaderboard(
  supabase: SupabaseClient,
  edition: string,
): Promise<StickerAlbumLeaderboard | null> {
  const { data, error } = await supabase.rpc("get_current_cyclo_stickers_leaderboard", {
    p_edition: edition,
  });
  return error || !data ? null : (data as StickerAlbumLeaderboard);
}
