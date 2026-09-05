import "server-only";

import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import {
  RACE_SIMULATION_EDITION_BATCH_SIZE,
  selectRaceJobPack,
  type RaceJobPack,
} from "@/lib/game/race-job-packs";
import { getStageLiveState } from "@/lib/game/race-live";
import { hasMinimumRaceEditionField } from "@/lib/game/race-results";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureLockedOfficialRaceSimulations } from "@/services/official-race-simulations";
import { syncDueNationalFederationChampionshipLineups } from "@/services/international-championship-selections";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export async function precomputeRequestedOfficialRaceReplay({
  calendar,
  raceEditionId,
  targetStageNumber,
  now = new Date(),
}: {
  calendar: SeasonRaceCalendar;
  raceEditionId: string;
  targetStageNumber: number;
  now?: Date;
}) {
  const edition = calendar.editions.find(
    (candidate) => candidate.id === raceEditionId,
  );
  if (!edition) return { loadedStages: 0, durationMs: 0 };

  const replayCalendar: SeasonRaceCalendar = {
    ...calendar,
    editions: [
      {
        ...edition,
        stages: edition.stages.filter(
          (stage) => stage.stageNumber <= targetStageNumber,
        ),
      },
    ],
  };
  const startedAt = Date.now();
  const directory = await ensureLockedOfficialRaceSimulations(
    replayCalendar,
    now,
  );
  const loadedStages = directory[raceEditionId]?.length ?? 0;
  const result = { loadedStages, durationMs: Date.now() - startedAt };
  console.info("requested_official_race_replay_precomputed", {
    raceEditionId,
    targetStageNumber,
    ...result,
  });
  return result;
}

export async function precomputeDueOfficialRaceSimulations(
  now = new Date(),
  {
    packIndex = 0,
    packCount = 1,
    maxEditions = RACE_SIMULATION_EDITION_BATCH_SIZE,
  }: Partial<RaceJobPack> & { maxEditions?: number } = {},
) {
  const startedAt = Date.now();
  // Les équipements sont figés cinq minutes avant le départ. Calculer avec un
  // léger horizon à cet instant évite que la première visite et le cron de
  // clôture des enchères travaillent au même moment que le départ réel.
  const simulationClock = new Date(now.getTime() + 6 * 60 * 1_000);
  // La sélection nationale est figée avant de lire la startlist servant au
  // live. L'index de fraîcheur évite toute écriture si aucun DS n'a modifié sa
  // réponse depuis le passage précédent.
  if (packIndex === 0) {
    try {
      await syncDueNationalFederationChampionshipLineups({
        now: simulationClock,
        force: false,
      });
    } catch (error) {
      // Une anomalie fédérale ne doit jamais empêcher les autres courses de se
      // préparer. Le passage de maintenance reprendra la synchronisation.
      console.error("federation_startlist_precompute_sync_failed", error);
    }
  }
  const admin = createSupabaseAdminClient();
  const discoveryStartedAt = Date.now();
  const discoveryCalendar = await getActiveSeasonRaceCalendar(
    admin,
    simulationClock,
    {
    includeEngagedCounts: true,
    includeEngagedRiders: false,
    includeIneligibleRegionalRaces: true,
    },
  );
  const discoveryDurationMs = Date.now() - discoveryStartedAt;

  if (!discoveryCalendar) {
    return createResult({
      startedAt,
      discoveryDurationMs,
      liveEditions: 0,
      targetedEditions: 0,
      eligibleEditions: 0,
      deferredEditions: 0,
      loadedStages: 0,
      packIndex,
      packCount,
    });
  }

  const liveEditions = discoveryCalendar.editions.filter(
    (edition) =>
      hasMinimumRaceEditionField(edition) &&
      edition.competitionType !== "national_road" &&
      edition.competitionType !== "national_time_trial" &&
      edition.stages.some(
        (stage) => getStageLiveState(stage, simulationClock).status === "live",
      ),
  );
  if (liveEditions.length === 0) {
    return createResult({
      startedAt,
      discoveryDurationMs,
      liveEditions: 0,
      targetedEditions: 0,
      eligibleEditions: 0,
      deferredEditions: 0,
      loadedStages: 0,
      packIndex,
      packCount,
    });
  }

  const startedStageIds = liveEditions.flatMap((edition) =>
    edition.stages.flatMap((stage) => {
      const status = getStageLiveState(stage, simulationClock).status;
      return status === "live" || status === "finished" ? [stage.id] : [];
    }),
  );
  const existing = await admin
    .from("official_stage_simulations")
    .select("stage_id")
    .in("stage_id", startedStageIds)
    .returns<Array<{ stage_id: string }>>();
  if (existing.error) {
    throw new Error(
      `Impossible de contrôler les simulations déjà prêtes : ${existing.error.message}`,
    );
  }

  const existingStageIds = new Set(
    (existing.data ?? []).map((row) => row.stage_id),
  );
  const missingEditions = liveEditions
    .filter((edition) =>
      edition.stages.some((stage) => {
        const status = getStageLiveState(stage, simulationClock).status;
        return (
          (status === "live" || status === "finished") &&
          !existingStageIds.has(stage.id)
        );
      }),
    )
    .sort((left, right) => {
      const leftDeparture = getEditionQueueTimestamp(left);
      const rightDeparture = getEditionQueueTimestamp(right);
      return leftDeparture - rightDeparture || left.id.localeCompare(right.id);
    });
  const jobPack = selectRaceJobPack({
    items: missingEditions,
    getId: (edition) => edition.id,
    packIndex,
    packCount,
    limit: maxEditions,
  });
  const targetedEditionIds = jobPack.items.map((edition) => edition.id);

  if (targetedEditionIds.length === 0) {
    return createResult({
      startedAt,
      discoveryDurationMs,
      liveEditions: liveEditions.length,
      targetedEditions: 0,
      eligibleEditions: jobPack.eligibleItems,
      deferredEditions: jobPack.deferredItems,
      loadedStages: 0,
      packIndex,
      packCount,
    });
  }

  const processingStartedAt = Date.now();
  const simulationCalendar = await getActiveSeasonRaceCalendar(
    admin,
    simulationClock,
    {
    includeIneligibleRegionalRaces: true,
    raceEditionIds: targetedEditionIds,
    },
  );
  if (!simulationCalendar) {
    throw new Error("La saison active a disparu pendant la préparation du live.");
  }

  const directory = await ensureLockedOfficialRaceSimulations(
    simulationCalendar,
    simulationClock,
  );
  const loadedStages = Object.values(directory).reduce(
    (total, simulations) => total + simulations.length,
    0,
  );

  return createResult({
    startedAt,
    discoveryDurationMs,
    liveEditions: liveEditions.length,
    targetedEditions: targetedEditionIds.length,
    eligibleEditions: jobPack.eligibleItems,
    deferredEditions: jobPack.deferredItems,
    loadedStages,
    packIndex,
    packCount,
    processingDurationMs: Date.now() - processingStartedAt,
  });
}

function getEditionQueueTimestamp(
  edition: SeasonRaceCalendar["editions"][number],
) {
  return edition.stages.reduce((earliest, stage) => {
    const timestamp = stage.departureAt ? Date.parse(stage.departureAt) : NaN;
    return Number.isFinite(timestamp) ? Math.min(earliest, timestamp) : earliest;
  }, Number.POSITIVE_INFINITY);
}

function createResult({
  startedAt,
  discoveryDurationMs,
  liveEditions,
  targetedEditions,
  eligibleEditions,
  deferredEditions,
  loadedStages,
  packIndex,
  packCount,
  processingDurationMs = 0,
}: {
  startedAt: number;
  discoveryDurationMs: number;
  liveEditions: number;
  targetedEditions: number;
  eligibleEditions: number;
  deferredEditions: number;
  loadedStages: number;
  packIndex: number;
  packCount: number;
  processingDurationMs?: number;
}) {
  return {
    liveEditions,
    targetedEditions,
    eligibleEditions,
    deferredEditions,
    loadedStages,
    pack: packIndex + 1,
    packCount,
    discoveryDurationMs,
    processingDurationMs,
    durationMs: Date.now() - startedAt,
  };
}
