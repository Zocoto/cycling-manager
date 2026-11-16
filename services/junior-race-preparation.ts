import "server-only";

import type {
  JuniorRaceInstruction,
  JuniorRacePreparationScope,
  JuniorRacePreparationStageType,
} from "@/lib/game/junior-race-preparation";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DevelopmentRaceProfile } from "@/services/development-team";

export type JuniorRacePreparationRider = {
  riderId: string;
  firstName: string;
  lastName: string;
  countryCode: string | null;
  instruction: JuniorRaceInstruction;
};

type JuniorRacePreparationRow = {
  race_edition_id: string;
  race_name: string;
  race_slug: string;
  stage_id: string;
  stage_number: number;
  stage_day_number: number;
  stage_name: string;
  stage_type: JuniorRacePreparationStageType;
  profile_type: DevelopmentRaceProfile;
  distance_km: number | string;
  preparation_closes_at: string;
  registration_id: string;
  scope: JuniorRacePreparationScope;
  country_code: string | null;
  riders: JuniorRacePreparationRider[];
};

export type JuniorRacePreparationStage = {
  id: string;
  number: number;
  day: number;
  name: string;
  type: JuniorRacePreparationStageType;
  profile: DevelopmentRaceProfile;
  distanceKm: number;
  closesAt: string;
  riders: JuniorRacePreparationRider[];
};

export type JuniorRacePreparationEntry = {
  registrationId: string;
  slug: string;
  name: string;
  scope: JuniorRacePreparationScope;
  countryCode: string | null;
  stages: JuniorRacePreparationStage[];
};

export async function getCurrentJuniorRacePreparations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase.rpc("get_current_junior_race_preparations");
  if (error) throw error;

  const entries = new Map<string, JuniorRacePreparationEntry>();
  for (const row of (data ?? []) as JuniorRacePreparationRow[]) {
    const key = `${row.race_edition_id}:${row.registration_id}`;
    const entry = entries.get(key) ?? {
      registrationId: row.registration_id,
      slug: row.race_slug,
      name: row.race_name,
      scope: row.scope,
      countryCode: row.country_code,
      stages: [],
    };
    entry.stages.push({
      id: row.stage_id,
      number: row.stage_number,
      day: row.stage_day_number,
      name: row.stage_name,
      type: row.stage_type,
      profile: row.profile_type,
      distanceKm: Number(row.distance_km),
      closesAt: row.preparation_closes_at,
      riders: row.riders,
    });
    entries.set(key, entry);
  }

  return [...entries.values()]
    .map((entry) => ({ ...entry, stages: entry.stages.sort((first, second) => first.number - second.number) }))
    .sort((first, second) => first.stages[0].day - second.stages[0].day || first.name.localeCompare(second.name, "fr"));
}
