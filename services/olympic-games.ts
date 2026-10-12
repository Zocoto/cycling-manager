import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NationsCupEvent } from "@/services/nations-cup";

export type OlympicNation = {
  country_id: string;
  country_code: string;
  country_name: string;
  qualification_rank: number;
  uci_rank: number;
  rider_quota: number;
  registered_riders: number;
  pending_riders: number;
  best_finish: number | null;
  exception_reason?: "existing_confirmed_selection" | "reallocated_for_confirmed_selection" | null;
};
export type OlympicOverview = {
  nations: OlympicNation[];
  qualificationFrozenAt: string | null;
};

export async function getOlympicOverview(seasonId: string): Promise<{ events: NationsCupEvent[]; olympics: OlympicOverview }> {
  const admin = createSupabaseAdminClient();
  const [event, nations] = await Promise.all([
    admin.from("national_federation_olympic_events").select("race_edition_id, qualification_frozen_at")
      .eq("season_id", seasonId).maybeSingle<{ race_edition_id: string; qualification_frozen_at: string | null }>(),
    admin.rpc("get_olympic_nation_standings", { p_season_id: seasonId }).returns<OlympicNation[]>(),
  ]);
  if (event.error) throw event.error;
  if (nations.error) throw nations.error;
  if (!event.data) return { events: [], olympics: { nations: [], qualificationFrozenAt: null } };
  const edition = await admin.from("race_editions").select("id,race_id,status")
    .eq("id", event.data.race_edition_id).single<{ id: string; race_id: string; status: string }>();
  if (edition.error) throw edition.error;
  const race = await admin.from("races").select("slug").eq("id", edition.data.race_id).single<{ slug: string }>();
  if (race.error) throw race.error;
  return {
    events: [{ id: "nc-hills", slug: "olympic-road", hrefSlug: race.data.slug, name: "Course en ligne",
      profileType: "mixed", status: edition.data.status }],
    olympics: { nations: nations.data ?? [], qualificationFrozenAt: event.data.qualification_frozen_at },
  };
}
