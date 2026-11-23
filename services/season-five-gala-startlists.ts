import "server-only";

import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import type { SeasonFiveGalaExportSource } from "@/lib/game/season-five-gala-startlists";
import type { SeasonFinaleGalaIdentity } from "./season-finale-gala-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Client = ReturnType<typeof createSupabaseAdminClient>;
type Query<T> = { range: (from: number, to: number) => { abortSignal: (signal: AbortSignal) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> } };

async function pages<T>(make: () => Query<T>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await make().range(from, from + 999).abortSignal(AbortSignal.timeout(5000));
    if (result.error) throw new Error(`S5 gala source unavailable: ${result.error.message}`);
    const page = result.data ?? []; rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

/** Explicit S5 source, read once after closing; independent of the active season. */
export async function loadSeasonFiveGalaExportSource(admin: Client = createSupabaseAdminClient(), now = new Date()): Promise<SeasonFiveGalaExportSource> {
  const season = await admin.from("seasons").select("id").eq("game_year", SEASON_FIVE_GALA.sourceSeason)
    .abortSignal(AbortSignal.timeout(5000)).single<{ id: string }>();
  if (season.error || !season.data) throw new Error("S5 gala source season is missing.");
  const result = await admin.from("season_gala_editions").select("id,source_season_id,target_game_year,registration_closes_at,status")
    .eq("source_season_id", season.data.id).abortSignal(AbortSignal.timeout(5000)).single<SeasonFiveGalaExportSource["edition"]>();
  const edition = result.data;
  if (result.error || !edition || edition.target_game_year !== 6 || !["open", "closed"].includes(edition.status)) throw new Error("S5 gala edition is unavailable.");
  if (!Number.isFinite(Date.parse(edition.registration_closes_at)) || now.getTime() < Date.parse(edition.registration_closes_at)) throw new Error("S5 gala packages can only be generated after registrations close.");
  const events = await pages<SeasonFiveGalaExportSource["events"][number]>(() => admin.from("season_gala_events")
    .select("edition_id,event_key,program,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,min_riders,max_riders")
    .eq("edition_id", edition.id).order("event_key"));
  const entries = await pages<SeasonFiveGalaExportSource["entries"][number]>(() => admin.from("season_gala_entries")
    .select("id,team_id,auth_user_id,program").eq("edition_id", edition.id).order("id"));
  const selections = await pages<SeasonFiveGalaExportSource["selections"][number]>(() => admin.from("season_gala_entry_riders")
    .select("entry_id,edition_id,event_key,program,rider_id,position").eq("edition_id", edition.id).order("entry_id").order("event_key").order("position"));
  const admissions: SeasonFiveGalaExportSource["admissions"] = [];
  const identities: SeasonFinaleGalaIdentity[] = [];
  for (let offset = 0; offset < entries.length; offset += 100) {
    const chunk = entries.slice(offset, offset + 100);
    admissions.push(...await pages<SeasonFiveGalaExportSource["admissions"][number]>(() => admin.from("season_gala_entry_admissions")
      .select("entry_id,rider_id,primary_snapshot").in("entry_id", chunk.map(entry => entry.id)).order("entry_id").order("rider_id")));
    const identityResult = await admin.rpc("get_season_five_gala_export_identities", { p_team_ids: chunk.map(entry => entry.team_id) })
      .abortSignal(AbortSignal.timeout(5000));
    if (identityResult.error) throw new Error(`S6 gala identities unavailable: ${identityResult.error.message}`);
    identities.push(...(identityResult.data ?? []) as SeasonFinaleGalaIdentity[]);
  }
  for (const entry of entries) {
    if (!identities.some(identity => identity.team_id === entry.team_id && identity.identity_season === 6 && identity.identity_ready)) throw new Error("A registered team's S6 identity still needs confirmation.");
  }
  // Deadline edits/reopening must not silently produce a mutable export.
  const closing = await admin.from("season_gala_editions").select("registration_closes_at,status")
    .eq("id", edition.id).abortSignal(AbortSignal.timeout(5000)).single<{ registration_closes_at: string; status: string }>();
  if (closing.error || closing.data?.registration_closes_at !== edition.registration_closes_at || closing.data?.status !== edition.status) throw new Error("The gala registration window changed during export.");
  return { edition, events, entries, selections, admissions, identities };
}
