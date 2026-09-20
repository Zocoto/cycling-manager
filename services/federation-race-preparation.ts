import "server-only";

import {
  parseRacePreparationRows,
  type RacePreparationEditionPlan,
} from "@/services/race-calendar";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function getCurrentFederationRacePreparation(
  supabase: SupabaseServerClient,
  countryCode: string,
): Promise<RacePreparationEditionPlan[]> {
  const { data, error } = await supabase.rpc(
    "get_current_national_federation_race_preparation",
    { p_country_code: countryCode.toUpperCase() },
  );

  if (error) {
    throw new Error(
      `Impossible de charger les préparations de la sélection : ${error.message}`,
    );
  }

  return parseRacePreparationRows(data);
}
