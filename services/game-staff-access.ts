import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { GAME_STAFF_CACHE_TAG, type GameStaffRole } from "@/lib/game/game-product-news";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Authorisation is checked fresh from the database, never JWT user_metadata or a visual badge. */
export async function getCurrentGameStaffRole(supabase: Client): Promise<GameStaffRole> {
  const result = await supabase.rpc("get_current_user_game_role").abortSignal(AbortSignal.timeout(3000));
  if (result.error) throw new Error("Les droits de l’équipe du jeu n’ont pas pu être vérifiés.");
  return result.data === "owner" || result.data === "game_staff" ? result.data : null;
}

// Presentation only: public director ids cannot grant access to any protected action.
export const getGameStaffDirectorIds = unstable_cache(async (): Promise<string[]> => {
  try {
    const result = await createSupabaseAdminClient().rpc("get_game_staff_directory")
      .abortSignal(AbortSignal.timeout(2000));
    if (result.error) throw new Error("Badge unavailable");
    return ((result.data ?? []) as { sporting_director_id: string }[]).map((row) => row.sporting_director_id);
  } catch {
    console.error("Les badges de l’équipe du jeu n’ont pas pu être chargés.");
    return [];
  }
}, ["game-staff-directory-v1"], { tags: [GAME_STAFF_CACHE_TAG], revalidate: 60 });
