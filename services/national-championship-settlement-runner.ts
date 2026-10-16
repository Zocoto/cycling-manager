import "server-only";

import { getStageLiveState } from "@/lib/game/race-live";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";
import { cancelUnviableRaceEditions } from "@/services/race-settlement-runner";

type NationalEdition = {
  id: string;
  status: string;
  stages: { departure_at: string | null; distance_km: number | string; status: "planned" | "in_progress" | "completed" | "cancelled" }[];
};

export function getDueNationalEditionIds(editions: NationalEdition[], now: Date) {
  return editions.filter(edition => !["completed", "cancelled"].includes(edition.status)
    && edition.stages.length > 0 && edition.stages.every(stage => getStageLiveState({
      departureAt: stage.departure_at, distanceKm: Number(stage.distance_km), status: stage.status,
    }, now).status === "finished"))
    .sort((a,b) => a.id.localeCompare(b.id)).map(edition => edition.id);
}

// Discover only small metadata, then claim and load ONE country at a time.
// Loading all 174 startlists first overflowed PostgREST URL/row limits and
// aborted both CN crons before a single country could be homologated.
export async function settleDueNationalChampionshipResults({
  seasonId, competitionType, now = new Date(), maxEditions = 16, timeBudgetMs = 180_000,
}: {
  seasonId: string;
  competitionType: "national_time_trial" | "national_road";
  now?: Date;
  maxEditions?: number;
  timeBudgetMs?: number;
}) {
  const admin = createSupabaseAdminClient();
  const startedAt = Date.now();
  const metadata = await admin.rpc("get_due_national_championship_edition_ids", {
    p_season_id:seasonId,p_competition_type:competitionType,p_now:now.toISOString(),
  });
  if (metadata.error) throw new Error(`Impossible de découvrir les CN à homologuer : ${metadata.error.message}`);
  const ids = ((metadata.data ?? []) as {race_edition_id:string}[]).map(row=>row.race_edition_id);
  const result = {targetedEditions:0, eligibleEditions:ids.length, deferredEditions:ids.length,
    processedStages:0,completedEditions:0,cancelledEditions:0,failedEditions:0};
  for (const id of ids) {
    if (result.targetedEditions >= maxEditions || Date.now()-startedAt >= timeBudgetMs) break;
    const claim = await admin.rpc("claim_race_editions_for_settlement", {p_race_edition_ids:[id]});
    if (claim.error) throw new Error(`Impossible de réserver le CN : ${claim.error.message}`);
    if (!Array.isArray(claim.data) || claim.data.length === 0) continue;
    result.targetedEditions++;
    try {
      const calendar = await getActiveSeasonRaceCalendar(admin, now, {
        includeIneligibleRegionalRaces:true, raceEditionIds:[id],
      });
      if (!calendar || calendar.seasonId !== seasonId || calendar.editions.length !== 1
        || calendar.editions[0].competitionType !== competitionType) throw new Error("Calendrier CN ciblé incomplet.");
      const edition = calendar.editions[0];
      if (edition.status === "completed") {
        // Results already committed before a previous conditions timeout.
        // Repair only the effect ledger; do not simulate, reward or rank again.
        for (const stage of edition.stages) {
          const conditions = await admin.rpc("settle_finished_stage_conditions", {p_stage_id:stage.id});
          if (conditions.error) throw new Error(conditions.error.message);
        }
        result.completedEditions++;
      } else if (edition.engagedRiders.length === 0) {
        result.cancelledEditions += await cancelUnviableRaceEditions({admin,editions:[edition]});
      } else {
        const settled = await settleFinishedRaceResults(calendar,now);
        result.processedStages += settled.processedStages;
        result.completedEditions += settled.completedEditions;
        result.failedEditions += settled.failedEditions;
      }
    } catch (error) {
      result.failedEditions++;
      console.error("national_championship_country_settlement_failed", {raceEditionId:id,error});
    }
  }
  result.deferredEditions = Math.max(0,ids.length-result.completedEditions-result.cancelledEditions);
  console.info("national_championship_batch_completed",{competitionType,...result,durationMs:Date.now()-startedAt});
  return result;
}
