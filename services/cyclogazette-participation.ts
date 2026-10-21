import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function loadCyclogazetteHumanRaceEditionIds(
  admin: AdminClient,
  seasonDayId: string,
  includeScheduled = false,
): Promise<string[]> {
  const result = await admin.rpc("get_cyclogazette_human_race_editions", {
    p_season_day_id: seasonDayId,
    p_include_scheduled: includeScheduled,
  });
  if (result.error || !Array.isArray(result.data)) {
    throw new Error("Impossible de vérifier la participation humaine pour La Cyclogazette.");
  }
  return [...new Set(result.data.map((row: { race_edition_id: string }) => row.race_edition_id))];
}

export async function loadCyclogazetteHumanDevelopmentEditionIds(admin: AdminClient, editionIds: readonly string[]): Promise<string[]> {
  if (editionIds.length === 0) return [];
  const result = await admin.rpc("get_cyclogazette_human_development_editions", { p_race_edition_ids: [...new Set(editionIds)] });
  if (result.error || !Array.isArray(result.data)) throw new Error("Impossible de vérifier la participation humaine des juniors.");
  return result.data.map((row: { race_edition_id: string }) => row.race_edition_id);
}
