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
  timeTrialNations?: OlympicNation[];
  qualificationFrozenAt: string | null;
};

export async function getOlympicOverview(seasonId: string): Promise<{ events: NationsCupEvent[]; olympics: OlympicOverview }> {
  const admin = createSupabaseAdminClient();
  const [event, nations, timeTrialNations] = await Promise.all([
    admin.from("national_federation_olympic_events").select("race_edition_id,time_trial_race_edition_id,qualification_frozen_at")
      .eq("season_id", seasonId).maybeSingle<{ race_edition_id: string; time_trial_race_edition_id: string | null; qualification_frozen_at: string | null }>(),
    admin.rpc("get_olympic_nation_standings", { p_season_id: seasonId }),
    admin.rpc("get_olympic_time_trial_nation_standings", { p_season_id: seasonId }),
  ]);
  if (event.error) throw event.error;
  if (nations.error) throw nations.error;
  if (timeTrialNations.error) throw timeTrialNations.error;
  if (!event.data) return { events: [], olympics: { nations: [], qualificationFrozenAt: null } };
  if (!Array.isArray(nations.data) || !Array.isArray(timeTrialNations.data)) throw new Error("Le classement olympique n’est pas disponible.");
  const programme = [
    { editionId: event.data.time_trial_race_edition_id, id: "nc-time-trial", slug: "olympic-time-trial", name: "Contre-la-montre", profileType: "time_trial" },
    { editionId: event.data.race_edition_id, id: "nc-hills", slug: "olympic-road", name: "Course en ligne", profileType: "mixed" },
  ].filter((entry) => entry.editionId !== null);
  const editions = await admin.from("race_editions").select("id,race_id,status")
    .in("id", programme.map((entry) => entry.editionId!)).returns<{ id: string; race_id: string; status: string }[]>();
  if (editions.error) throw editions.error;
  const races = await admin.from("races").select("id,slug")
    .in("id", editions.data.map((edition) => edition.race_id)).returns<{ id: string; slug: string }[]>();
  if (races.error) throw races.error;
  return {
    events: programme.map(({ editionId, ...entry }) => {
      const edition = editions.data.find((row) => row.id === editionId);
      const race = races.data.find((row) => row.id === edition?.race_id);
      if (!edition || !race) throw new Error("Le programme olympique est incomplet.");
      return { ...entry, hrefSlug: race.slug, status: edition.status };
    }),
    olympics: { nations: nations.data as OlympicNation[], timeTrialNations: timeTrialNations.data as OlympicNation[], qualificationFrozenAt: event.data.qualification_frozen_at },
  };
}
