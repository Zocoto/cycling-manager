import "server-only";
import { SPONSORS } from "@/data/sponsors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GalaProgram, GalaProfile } from "@/lib/game/season-four-gala";
import type { SeasonFourGalaContext, GalaPublicEntries } from "@/lib/game/season-four-gala-registration";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export async function getCurrentSeasonFourGalaContext(client: Client): Promise<SeasonFourGalaContext> {
  const { data, error } = await client.rpc("get_current_season_four_gala_context").abortSignal(AbortSignal.timeout(6000));
  if (error || !data) throw new Error("Les inscriptions du gala sont temporairement indisponibles.");
  return data as SeasonFourGalaContext;
}

const jerseyPaths = new Map(SPONSORS.flatMap(sponsor => sponsor.jerseys.map(jersey => [jersey.id, jersey.imagePath] as const)));
export async function getSeasonFourGalaEntries(client: Client, program: GalaProgram, profile: GalaProfile, page: number): Promise<GalaPublicEntries> {
  const { data, error } = await client.rpc("get_season_four_gala_entries", { p_program: program, p_profile: profile, p_page: page }).abortSignal(AbortSignal.timeout(6000));
  if (error || !data) throw new Error("Impossible de charger les engagés du gala.");
  const result = data as Omit<GalaPublicEntries, "teams"> & { teams: (GalaPublicEntries["teams"][number] & { jerseyId?: string })[] };
  return { ...result, teams: result.teams.map(({ jerseyId, ...team }) => ({ ...team, jerseyImagePath: jerseyId ? jerseyPaths.get(jerseyId) ?? null : null })) };
}
