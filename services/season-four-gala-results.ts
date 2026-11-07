import "server-only";
import { GALA_EVENTS, getGalaEvent, type GalaEventKey } from "@/lib/game/season-four-gala";
import { seasonFourGalaResultsSchema } from "@/lib/game/season-four-gala-rewards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class GalaResultImportError extends Error {}

export type GalaPublishedResult = { rank: number; riderName: string; teamName: string };

type StoredGalaResult = { rank: unknown; rider_id: unknown; team_id: unknown };
type StoredGalaImport = { event_key: string; season_id: string; results: StoredGalaResult[] };
type GalaRiderName = { id: string; first_name: string; last_name: string };
type GalaTeamName = { team_id: string; display_name: string };

export async function getSeasonFourGalaPublishedResults(): Promise<Partial<Record<GalaEventKey, GalaPublishedResult[]>>> {
  const admin = createSupabaseAdminClient();
  const signal = AbortSignal.timeout(5000);
  const { data, error } = await admin.from("season_gala_result_imports")
    .select("event_key, season_id, results")
    .in("event_key", GALA_EVENTS.map(event => event.key))
    .limit(GALA_EVENTS.length)
    .abortSignal(signal)
    .returns<StoredGalaImport[]>();
  if (error) throw new Error("Impossible de lire les classements du gala.");
  if (!data?.length) return {};

  // Imports are restricted to S4 by the settlement RPC. Keep their historical
  // team names after the rollover or any subsequent sponsor change.
  const seasonId = data[0].season_id;
  if (data.some(row => row.season_id !== seasonId)) throw new Error("Saison des classements du gala incohérente.");
  const imports = data.map(row => seasonFourGalaResultsSchema.parse({
    eventKey: row.event_key,
    results: row.results.map(result => ({ rank: result.rank, riderId: result.rider_id, teamId: result.team_id })),
  }));
  const riderIds = [...new Set(imports.flatMap(entry => entry.results.map(row => row.riderId)))];
  const teamIds = [...new Set(imports.flatMap(entry => entry.results.map(row => row.teamId)))];
  const [riders, teams] = await Promise.all([
    admin.from("riders").select("id, first_name, last_name").in("id", riderIds)
      .abortSignal(signal).returns<GalaRiderName[]>(),
    admin.from("team_seasons").select("team_id, display_name").eq("season_id", seasonId).in("team_id", teamIds)
      .abortSignal(signal).returns<GalaTeamName[]>(),
  ]);
  if (riders.error || teams.error) throw new Error("Impossible de lire les noms du classement du gala.");
  const riderNames = new Map(riders.data?.map(rider => [rider.id, `${rider.first_name} ${rider.last_name}`]));
  const teamNames = new Map(teams.data?.map(team => [team.team_id, team.display_name]));
  const published: Partial<Record<GalaEventKey, GalaPublishedResult[]>> = {};
  for (const entry of imports) {
    const event = getGalaEvent(entry.eventKey)!;
    published[event.key] = entry.results.map(({ rank, riderId, teamId }) => {
      const riderName = riderNames.get(riderId);
      const teamName = teamNames.get(teamId);
      if (!riderName || !teamName) throw new Error("Une identité manque dans le classement du gala.");
      return { rank, riderName, teamName };
    }).sort((left, right) => left.rank - right.rank);
  }
  return published;
}

export async function getSeasonFourGalaLiveParticipants(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const signal = AbortSignal.timeout(5000);
  const pageSize = 500;
  const names: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.from("season_gala_live_reward_grants")
      .select("participant_name")
      .order("participant_name")
      .order("auth_user_id")
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal)
      .returns<{ participant_name: string }[]>();
    if (error) throw new Error("Impossible de lire les participants au live du gala.");
    for (const participant of data ?? []) names.push(participant.participant_name);
    if (!data || data.length < pageSize) return names;
  }
}

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
