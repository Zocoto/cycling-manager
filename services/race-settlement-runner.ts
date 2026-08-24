import "server-only";

import { isRaceEditionSettlementCandidate } from "@/lib/game/race-results";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import {
  loadIncompleteCompletedEditionIds,
  settleFinishedRaceResults,
} from "@/services/race-results";

export async function settleDueStandardRaceResults({
  now = new Date(),
  raceSlug,
}: {
  now?: Date;
  raceSlug?: string;
} = {}) {
  const admin = createSupabaseAdminClient();
  const discoveryCalendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeEngagedCounts: false,
    includeEngagedRiders: false,
    includeIneligibleRegionalRaces: true,
    raceSlug,
  });

  if (!discoveryCalendar) {
    return {
      calendar: null,
      targetedEditions: 0,
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
    };
  }

  const repairableCompletedEditionIds =
    await loadIncompleteCompletedEditionIds({
      admin,
      calendar: discoveryCalendar,
    });
  const targetEditionIds = discoveryCalendar.editions
    .filter(
      (edition) =>
        edition.competitionType !== "national_road" &&
        edition.competitionType !== "national_time_trial" &&
        isRaceEditionSettlementCandidate(
          edition,
          repairableCompletedEditionIds,
          now,
        ),
    )
    .map((edition) => edition.id);

  if (targetEditionIds.length === 0) {
    return {
      calendar: discoveryCalendar,
      targetedEditions: 0,
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
    };
  }

  const settlementCalendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeIneligibleRegionalRaces: true,
    raceEditionIds: targetEditionIds,
  });
  if (!settlementCalendar) {
    throw new Error("La saison active a disparu pendant le règlement.");
  }

  const settlement = await settleFinishedRaceResults(
    settlementCalendar,
    now,
    undefined,
    repairableCompletedEditionIds,
  );
  return {
    calendar: discoveryCalendar,
    targetedEditions: targetEditionIds.length,
    ...settlement,
  };
}
