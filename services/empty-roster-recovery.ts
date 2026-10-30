import "server-only";

import { generateInitialRiderIdentities } from "@/lib/rider-names/generate-rider-identities";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type EmptyRosterRecoveryState = {
  available: boolean;
  team_country_id: string;
  team_country_name: string;
  team_country_iso_alpha2: string;
  name_profile_code: string | null;
  recovered_this_season: boolean;
  has_committed_riders: boolean;
};

export async function getCurrentEmptyRosterRecoveryState(
  supabase: SupabaseServerClient,
): Promise<EmptyRosterRecoveryState | null> {
  const { data, error } = await supabase
    .rpc("get_current_empty_roster_recovery_state")
    .maybeSingle<EmptyRosterRecoveryState>();
  if (error) {
    throw new Error("La possibilité de relancer votre effectif n’a pas pu être vérifiée. Réessayez dans un instant.");
  }
  return data;
}

export async function recoverCurrentEmptyTeamRoster(supabase: SupabaseServerClient) {
  // Read the current team again at submission time. Neither its country nor
  // rider attributes come from the form; SQL rechecks eligibility under locks.
  const state = await getCurrentEmptyRosterRecoveryState(supabase);
  if (!state?.available || !state.name_profile_code) {
    throw new Error(state?.recovered_this_season
      ? "La relance d’effectif a déjà été utilisée cette saison."
      : "La relance est réservée aux équipes sans coureur sous contrat pour la saison en cours.");
  }
  const identities = generateInitialRiderIdentities(state.name_profile_code);
  const { data, error } = await supabase.rpc("recover_current_empty_team_roster", {
    p_rider_identities: identities,
    p_expected_country_id: state.team_country_id,
  });
  if (error) {
    console.error("empty_roster_recovery_failed", { code: error.code, message: error.message });
    throw new Error("Votre effectif n’a pas pu être relancé. Actualisez la page et réessayez ; aucun coureur n’est ajouté en cas d’échec.");
  }
  const result = data as { status?: string; rider_count?: number } | null;
  if (result?.status !== "created" && result?.status !== "already_recovered") {
    throw new Error("Le résultat de la relance est indisponible. Actualisez l’effectif avant de réessayer.");
  }
  return result.status;
}
