import "server-only";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";
import { isQuadrennialGamesEdition } from "@/lib/game/quadrennial-games";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Edition = Pick<RaceCalendarEdition, "id" | "name" | "competitionType">;

export function usesFederationClubRewards(edition: Edition, gameYear: number) {
  return gameYear >= 3 && !isQuadrennialGamesEdition(edition)
    && !(gameYear === 3 && edition.competitionType === "continental_championship")
    && (edition.competitionType === "continental_championship"
      || edition.competitionType === "world_championship"
      || edition.competitionType === "nations_cup");
}

/** The selection represents a nation; club ownership is resolved at departure. */
export async function settleFederationRaceClubRewards(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  edition: Edition,
  gameYear: number,
) {
  if (!usesFederationClubRewards(edition, gameYear)) return;
  const { error } = await admin.rpc("settle_federation_race_club_rewards", {
    p_race_edition_id: edition.id,
  }).abortSignal(AbortSignal.timeout(6000));
  if (error) throw new Error(`Impossible de verser les gains internationaux de ${edition.name} : ${error.message}`);
}
