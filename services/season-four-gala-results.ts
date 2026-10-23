import "server-only";
import { seasonFourGalaResultsSchema } from "@/lib/game/season-four-gala-rewards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class GalaResultImportError extends Error {}

// Only called by the authenticated private admin endpoint, never by page reads,
// exports, cron or ordinary race settlement. One bounded RPC, no per-rider calls.
export async function importSeasonFourGalaResults(input: unknown) {
  const parsed = seasonFourGalaResultsSchema.parse(input);
  const response = await createSupabaseAdminClient().rpc("settle_season_four_gala_results", {
    p_event_key: parsed.eventKey,
    p_results: parsed.results.map(row => ({ rank: row.rank, rider_id: row.riderId, team_id: row.teamId })),
  }).abortSignal(AbortSignal.timeout(5000));
  if (response.error) {
    if (response.error.code === "P0001" || response.error.code === "P0002") {
      throw new GalaResultImportError(response.error.code === "P0002"
        ? "Une équipe récompensée n’a pas de manager ou d’inventaire actif. Aucun lot n’a été distribué."
        : response.error.message);
    }
    console.error("gala_s4_result_import_failed", { code: response.error.code });
    throw new Error("Attribution non confirmée. Réessayez avec le même classement : les lots ne seront pas doublés.");
  }
  const receipt = response.data as Record<string, unknown> | null;
  if (!receipt || receipt.eventKey !== parsed.eventKey || receipt.rewardedRiders !== 10
    || receipt.equipmentUnits !== 3 || receipt.consumableUnits !== 25 || typeof receipt.alreadyImported !== "boolean") {
    throw new Error("Le reçu d’attribution du gala est incomplet.");
  }
  return receipt;
}
