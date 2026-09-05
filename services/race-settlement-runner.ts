import "server-only";

import {
  hasMinimumRaceEditionField,
  isRaceEditionSettlementCandidate,
} from "@/lib/game/race-results";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  RACE_SETTLEMENT_EDITION_BATCH_SIZE,
  selectRaceJobPack,
  type RaceJobPack,
} from "@/lib/game/race-job-packs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import {
  loadIncompleteCompletedEditionIds,
  settleFinishedRaceResults,
} from "@/services/race-results";

export async function settleDueStandardRaceResults({
  now = new Date(),
  raceSlug,
  packIndex = 0,
  packCount = 1,
  maxEditions = RACE_SETTLEMENT_EDITION_BATCH_SIZE,
}: {
  now?: Date;
  raceSlug?: string;
  packIndex?: RaceJobPack["packIndex"];
  packCount?: RaceJobPack["packCount"];
  maxEditions?: number;
} = {}) {
  const admin = createSupabaseAdminClient();
  const discoveryCalendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeEngagedCounts: true,
    includeEngagedRiders: false,
    includeIneligibleRegionalRaces: true,
    raceSlug,
  });

  if (!discoveryCalendar) {
    return {
      calendar: null,
      targetedEditions: 0,
      eligibleEditions: 0,
      deferredEditions: 0,
      skippedUnviableEditions: 0,
      pack: raceSlug ? 1 : packIndex + 1,
      packCount: raceSlug ? 1 : packCount,
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
  const temporalCandidateEditions = discoveryCalendar.editions
    .filter(
      (edition) =>
        edition.competitionType !== "national_road" &&
        edition.competitionType !== "national_time_trial" &&
        isRaceEditionSettlementCandidate(
          edition,
          repairableCompletedEditionIds,
          now,
        ),
    );
  const candidateEditions = temporalCandidateEditions.filter(
    (edition) =>
      repairableCompletedEditionIds.has(edition.id) ||
      hasMinimumRaceEditionField(edition),
  );
  const candidateEditionIds = candidateEditions.map((edition) => edition.id);
  const previousClaimAtByEditionId = new Map<string, number>();
  if (candidateEditionIds.length > 0) {
    const { data: previousClaimRows, error: previousClaimError } = await admin
      .from("race_edition_settlement_claims")
      .select("race_edition_id, claimed_at")
      .in("race_edition_id", candidateEditionIds)
      .returns<Array<{ race_edition_id: string; claimed_at: string }>>();
    if (previousClaimError) {
      throw new Error(
        `Impossible de prioriser la file des courses : ${previousClaimError.message}`,
      );
    }
    for (const row of previousClaimRows ?? []) {
      const claimedAt = Date.parse(row.claimed_at);
      if (Number.isFinite(claimedAt)) {
        previousClaimAtByEditionId.set(row.race_edition_id, claimedAt);
      }
    }
  }
  candidateEditions.sort((left, right) => {
    const leftClaimedAt = previousClaimAtByEditionId.get(left.id);
    const rightClaimedAt = previousClaimAtByEditionId.get(right.id);
    if (leftClaimedAt === undefined && rightClaimedAt !== undefined) return -1;
    if (leftClaimedAt !== undefined && rightClaimedAt === undefined) return 1;
    if (
      leftClaimedAt !== undefined &&
      rightClaimedAt !== undefined &&
      leftClaimedAt !== rightClaimedAt
    ) {
      return leftClaimedAt - rightClaimedAt;
    }
    const leftDeparture = getEditionQueueTimestamp(left, now);
    const rightDeparture = getEditionQueueTimestamp(right, now);
    return leftDeparture - rightDeparture || left.id.localeCompare(right.id);
  });
  const jobPack = raceSlug
    ? {
        packIndex: 0,
        packCount: 1,
        items: candidateEditions,
        eligibleItems: candidateEditions.length,
        deferredItems: 0,
      }
    : selectRaceJobPack({
        items: candidateEditions,
        getId: (edition) => edition.id,
        packIndex,
        packCount,
        limit: maxEditions,
      });
  const targetEditionIds = jobPack.items.map((edition) => edition.id);
  const skippedUnviableEditions =
    temporalCandidateEditions.length - candidateEditions.length;

  if (targetEditionIds.length === 0) {
    return {
      calendar: discoveryCalendar,
      targetedEditions: 0,
      eligibleEditions: jobPack.eligibleItems,
      deferredEditions: jobPack.deferredItems,
      skippedUnviableEditions,
      pack: raceSlug ? 1 : packIndex + 1,
      packCount: raceSlug ? 1 : packCount,
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
    };
  }

  // Une ouverture de page de résultats peut coïncider avec le cron ou avec
  // celle d'un autre spectateur. On réserve d'abord les éditions à traiter :
  // les autres requêtes s'arrêtent ici, avant de charger les startlists et les
  // lourds scénarios de course.
  const { data: claimedRows, error: claimError } = await admin.rpc(
    "claim_race_editions_for_settlement",
    { p_race_edition_ids: targetEditionIds },
  );
  if (claimError) {
    throw new Error(
      `Impossible de réserver les courses à homologuer : ${claimError.message}`,
    );
  }
  const claimedEditionIds = (
    (claimedRows as Array<{ race_edition_id: string }> | null) ?? []
  ).map((row) => row.race_edition_id);

  if (claimedEditionIds.length === 0) {
    return {
      calendar: discoveryCalendar,
      targetedEditions: 0,
      eligibleEditions: jobPack.eligibleItems,
      deferredEditions: jobPack.deferredItems,
      skippedUnviableEditions,
      pack: raceSlug ? 1 : packIndex + 1,
      packCount: raceSlug ? 1 : packCount,
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
    };
  }

  const settlementCalendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeIneligibleRegionalRaces: true,
    raceEditionIds: claimedEditionIds,
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
    targetedEditions: claimedEditionIds.length,
    eligibleEditions: jobPack.eligibleItems,
    deferredEditions: jobPack.deferredItems,
    skippedUnviableEditions,
    pack: raceSlug ? 1 : packIndex + 1,
    packCount: raceSlug ? 1 : packCount,
    ...settlement,
  };
}

function getEditionQueueTimestamp(
  edition: NonNullable<
    Awaited<ReturnType<typeof getActiveSeasonRaceCalendar>>
  >["editions"][number],
  now: Date,
) {
  const unsettledFinishedStages = edition.stages.filter(
    (stage) =>
      stage.status !== "completed" &&
      getStageLiveState(stage, now).status === "finished",
  );
  const queueStages =
    unsettledFinishedStages.length > 0
      ? unsettledFinishedStages
      : edition.stages.slice(-1);

  return queueStages.reduce((earliest, stage) => {
    const timestamp = stage.departureAt ? Date.parse(stage.departureAt) : NaN;
    return Number.isFinite(timestamp) ? Math.min(earliest, timestamp) : earliest;
  }, Number.POSITIVE_INFINITY);
}
