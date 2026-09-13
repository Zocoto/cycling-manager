"use server";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RiderProgressionHistory } from "@/lib/game/rider-progression";
import { getRiderProgressionHistories } from "@/services/rider-progression";

type RosterRow = {
  rider_id: string;
};

export async function loadTeamRiderProgression(
  riderId: string,
  currentSeasonId: string,
): Promise<RiderProgressionHistory> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    throw new Error("Session expirée. Rechargez la page pour continuer.");
  }

  const { data, error } = await supabase.rpc(
    "get_current_team_roster_with_potential",
  );

  if (error) {
    throw new Error(`Impossible de vérifier l’effectif : ${error.message}`);
  }

  const belongsToCurrentTeam = ((data ?? []) as RosterRow[]).some(
    (rider) => rider.rider_id === riderId,
  );

  if (!belongsToCurrentTeam) {
    throw new Error("Ce coureur ne fait pas partie de votre effectif actuel.");
  }

  const [history] = await getRiderProgressionHistories({
    riderIds: [riderId],
    currentSeasonId,
  });

  if (!history) {
    throw new Error("L’historique de progression est indisponible.");
  }

  return history;
}
