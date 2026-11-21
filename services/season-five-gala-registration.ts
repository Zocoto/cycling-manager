import "server-only";

import {
  parseSeasonFiveGalaContext,
  type SeasonFiveGalaContext,
} from "@/lib/game/season-five-gala-registration";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const unavailableMessage = "Les inscriptions du gala sont temporairement indisponibles. Réessayez dans un instant.";

export async function getCurrentSeasonFiveGalaContext(client: Client): Promise<SeasonFiveGalaContext> {
  try {
    const { data, error } = await client
      .rpc("get_current_season_five_gala_context")
      .abortSignal(AbortSignal.timeout(8000));
    const context = error ? null : parseSeasonFiveGalaContext(data);
    if (!context) throw new Error(unavailableMessage);
    return context;
  } catch {
    throw new Error(unavailableMessage);
  }
}
