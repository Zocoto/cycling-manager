import "server-only";

import { randomUUID } from "node:crypto";

import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  getPersistedStageResultUnavailableRiderIds,
  getPersistedUnavailableRiderIdsAtStageDeparture,
  isUnavailableForFollowingStage,
  normalizeOfficialStageResultRanks,
  OFFICIAL_RACE_ENGINE_VERSION,
  type LockedOfficialRaceSimulationDirectory,
  type LockedOfficialStageSimulation,
  type PersistedStageRiderUnavailability,
  type RiderUnavailabilityWindow,
} from "@/lib/game/official-race-simulation";
import { createCalendarSimulationInput } from "@/lib/game/race-simulation-demo";
import {
  buildStageRaceStandings,
  getMountainObjectiveRiderIdsByTeam,
  simulateRaceStage,
  type StageSimulationInput,
  type StageSimulationResult,
} from "@/lib/game/race-simulation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";

type OfficialStageSimulationRow = {
  stage_id: string;
  race_edition_id: string;
  engine_version: string;
  seed: string;
  input_data: StageSimulationInput;
  simulation_data: StageSimulationResult;
};

type OfficialSimulationClaimRow = {
  claim_token: string;
  claimed_at: string;
};

type RiderInjuryWindowRow = {
  rider_id: string;
  started_at: string;
  expected_recovery_at: string;
  recovered_at: string | null;
};

type PersistedUnavailableStageResultRow = {
  stage_id: string;
  race_roster_id: string;
};

type RaceRosterRiderRow = {
  id: string;
  rider_id: string;
};

type PersistedCourseUnavailabilityRow = {
  stage_id: string;
  rider_id: string;
};

const OFFICIAL_SIMULATION_CLAIM_STALE_MS = 120_000;
const OFFICIAL_SIMULATION_POLL_ATTEMPTS = 20;
const OFFICIAL_SIMULATION_POLL_DELAY_MS = 75;
const RECENT_STAGE_RACE_REPAIR_WINDOW_MS = 24 * 60 * 60 * 1_000;

export async function ensureLockedOfficialRaceSimulations(
  calendar: SeasonRaceCalendar,
  now = new Date()
): Promise<LockedOfficialRaceSimulationDirectory> {
  const admin = createSupabaseAdminClient();
  const stageIds = calendar.editions.flatMap((edition) =>
    edition.stages.map((stage) => stage.id)
  );
  if (stageIds.length === 0) return {};

  const { data, error } = await collectChunkedPaginatedRows<
    OfficialStageSimulationRow,
    { message: string },
    string
  >({
    values: stageIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("official_stage_simulations")
        .select(
          "stage_id, race_edition_id, engine_version, seed, input_data, simulation_data"
        )
        .in("stage_id", chunk)
        .order("stage_id", { ascending: true })
        .range(from, to)
        .returns<OfficialStageSimulationRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(error, "les scénarios officiels existants");

  const lockedByStageId = new Map(
    (data ?? []).map((row) => [row.stage_id, toLockedSimulation(row)])
  );
  const [
    persistedUnavailabilityWindows,
    persistedStageResultUnavailabilities,
    persistedCourseUnavailabilities,
  ] = await Promise.all([
    loadPersistedRiderUnavailabilityWindows(calendar, now),
    loadPersistedStageResultUnavailabilities(calendar, now),
    loadPersistedCourseUnavailabilities(calendar, now),
  ]);
  const persistedStageUnavailabilities = [
    ...persistedStageResultUnavailabilities,
    ...persistedCourseUnavailabilities,
  ];
  const directory: LockedOfficialRaceSimulationDirectory = {};

  for (const edition of calendar.editions) {
    const unavailableRiderIds = new Set<string>();
    const editionSimulations: LockedOfficialStageSimulation[] = [];
    const orderedStages = [...edition.stages].sort(
      (first, second) =>
        first.stageNumber - second.stageNumber ||
        first.id.localeCompare(second.id)
    );

    for (const stage of orderedStages) {
      for (const riderId of getPersistedStageResultUnavailableRiderIds({
        raceEditionId: edition.id,
        stageNumber: stage.stageNumber,
        unavailabilities: persistedStageUnavailabilities,
      })) {
        unavailableRiderIds.add(riderId);
      }
      for (const riderId of getPersistedUnavailableRiderIdsAtStageDeparture({
        departureAt: stage.departureAt,
        windows: persistedUnavailabilityWindows,
      })) {
        unavailableRiderIds.add(riderId);
      }

      let lockedSimulation = lockedByStageId.get(stage.id) ?? null;

      // Une ligne officielle déjà enregistrée appartient à l'historique de la
      // course. Sa version de moteur, ses partants et son résultat restent
      // intacts : seuls les départs encore dépourvus de simulation utilisent
      // la version courante du moteur.
      if (!lockedSimulation) {
        const liveState = getStageLiveState(stage, now);
        if (
          liveState.status === "scheduled" ||
          liveState.status === "cancelled" ||
          edition.engagedRiders.length === 0
        ) {
          break;
        }

        const claimToken = await acquireOfficialSimulationClaim(
          stage.id,
          edition.id,
        );

        if (!claimToken) {
          lockedSimulation = await waitForLockedSimulation(stage.id);
          if (!lockedSimulation) break;
          lockedByStageId.set(stage.id, lockedSimulation);
        } else {
          try {
            const standingsBeforeStage =
              edition.raceFormat === "stage_race" &&
              editionSimulations.length > 0
                ? buildStageRaceStandings(
                    editionSimulations.map((locked) => locked.simulation),
                  )
                : null;
            const input = createCalendarSimulationInput({
              edition,
              stage,
              seed: `${edition.id}:${stage.id}:official`,
            });
            const mountainObjectiveRiderIds =
              getMountainObjectiveRiderIdsByTeam(
                editionSimulations.at(-1)?.simulation.resolvedRiders ?? [],
              );
            const officialInput: StageSimulationInput = {
              ...input,
              generalClassification: standingsBeforeStage?.general,
              unavailableRiderIds: [...unavailableRiderIds].sort(),
              ...(Object.keys(mountainObjectiveRiderIds).length > 0
                ? { mountainObjectiveRiderIds }
                : {}),
            };
            const simulation = normalizeOfficialStageResultRanks(
              simulateRaceStage(officialInput),
            );
            const candidate: LockedOfficialStageSimulation = {
              stageId: stage.id,
              raceEditionId: edition.id,
              engineVersion: OFFICIAL_RACE_ENGINE_VERSION,
              seed: String(officialInput.seed),
              input: officialInput,
              simulation,
            };
            lockedSimulation = await insertOrReadLockedSimulation(candidate);
            lockedByStageId.set(stage.id, lockedSimulation);
          } finally {
            await releaseOfficialSimulationClaim(stage.id, claimToken);
          }
        }
      }

      editionSimulations.push(lockedSimulation);
      for (const result of lockedSimulation.simulation.results) {
        if (isUnavailableForFollowingStage(result)) {
          unavailableRiderIds.add(result.riderId);
        }
      }
    }

    if (editionSimulations.length > 0) {
      directory[edition.id] = editionSimulations;
    }
  }

  return directory;
}

/**
 * Registre sportif immuable : il est écrit par l'homologation de la course,
 * indépendamment de la Gazette et de l'état médical courant. Il permet de
 * reconstruire une étape sans jamais faire repartir un coureur déjà retiré.
 */
async function loadPersistedCourseUnavailabilities(
  calendar: SeasonRaceCalendar,
  now: Date,
): Promise<PersistedStageRiderUnavailability[]> {
  const activeStageRaceEditions = getRepairableStageRaceEditions(calendar, now);
  const stageById = new Map(
    activeStageRaceEditions.flatMap((edition) =>
      edition.stages.map(
        (stage) =>
          [
            stage.id,
            {
              raceEditionId: edition.id,
              stageNumber: stage.stageNumber,
            },
          ] as const,
      ),
    ),
  );
  const stageIds = [...stageById.keys()];
  if (stageIds.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await collectChunkedPaginatedRows<
    PersistedCourseUnavailabilityRow,
    { message: string },
    string
  >({
    values: stageIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("stage_rider_unavailabilities")
        .select("stage_id, rider_id")
        .in("stage_id", chunk)
        .order("stage_id", { ascending: true })
        .order("rider_id", { ascending: true })
        .range(from, to)
        .returns<PersistedCourseUnavailabilityRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(error, "le registre sportif des non-partants");

  return (data ?? []).flatMap((row) => {
    const stage = stageById.get(row.stage_id);
    return stage
      ? [
          {
            ...stage,
            riderId: row.rider_id,
          },
        ]
      : [];
  });
}

async function loadPersistedStageResultUnavailabilities(
  calendar: SeasonRaceCalendar,
  now: Date,
): Promise<PersistedStageRiderUnavailability[]> {
  const activeStageRaceEditions = getRepairableStageRaceEditions(calendar, now);
  const stageById = new Map(
    activeStageRaceEditions.flatMap((edition) =>
      edition.stages.map(
        (stage) =>
          [
            stage.id,
            {
              raceEditionId: edition.id,
              stageNumber: stage.stageNumber,
            },
          ] as const,
      ),
    ),
  );
  const stageIds = [...stageById.keys()];
  if (stageIds.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const { data: resultRows, error: resultError } =
    await collectChunkedPaginatedRows<
      PersistedUnavailableStageResultRow,
      { message: string },
      string
    >({
      values: stageIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("stage_results")
          .select("stage_id, race_roster_id")
          .in("stage_id", chunk)
          .or(
            "injury_id.not.is.null,status.in.(did_not_start,did_not_finish,disqualified,outside_time_limit)",
          )
          .order("stage_id", { ascending: true })
          .order("race_roster_id", { ascending: true })
          .range(from, to)
          .returns<PersistedUnavailableStageResultRow[]>();
        return { data: result.data, error: result.error };
      },
    });
  assertQuery(resultError, "les non-partants officiels deja enregistres");

  const rosterIds = [
    ...new Set((resultRows ?? []).map((row) => row.race_roster_id)),
  ];
  if (rosterIds.length === 0) return [];

  const { data: rosterRows, error: rosterError } =
    await collectChunkedPaginatedRows<
      RaceRosterRiderRow,
      { message: string },
      string
    >({
      values: rosterIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_rosters")
          .select("id, rider_id")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceRosterRiderRow[]>();
        return { data: result.data, error: result.error };
      },
    });
  assertQuery(rosterError, "l'identite des non-partants officiels");

  const riderIdByRosterId = new Map(
    (rosterRows ?? []).map((row) => [row.id, row.rider_id]),
  );
  return (resultRows ?? []).flatMap((row) => {
    const stage = stageById.get(row.stage_id);
    const riderId = riderIdByRosterId.get(row.race_roster_id);
    return stage && riderId
      ? [
          {
            ...stage,
            riderId,
          },
        ]
      : [];
  });
}

async function loadPersistedRiderUnavailabilityWindows(
  calendar: SeasonRaceCalendar,
  now: Date,
): Promise<RiderUnavailabilityWindow[]> {
  const activeStageRaceEditions = getRepairableStageRaceEditions(calendar, now);
  const riderIds = [
    ...new Set(
      activeStageRaceEditions.flatMap((edition) =>
        edition.engagedRiders.map((rider) => rider.id),
      ),
    ),
  ];
  const departureTimestamps = activeStageRaceEditions
    .flatMap((edition) => edition.stages)
    .flatMap((stage) => {
      const timestamp = stage.departureAt
        ? Date.parse(stage.departureAt)
        : Number.NaN;
      return Number.isFinite(timestamp) ? [timestamp] : [];
    });
  if (riderIds.length === 0 || departureTimestamps.length === 0) return [];

  const earliestDepartureAt = new Date(
    Math.min(...departureTimestamps),
  ).toISOString();
  const latestDepartureAt = new Date(
    Math.max(...departureTimestamps),
  ).toISOString();
  const admin = createSupabaseAdminClient();
  const { data, error } = await collectChunkedPaginatedRows<
    RiderInjuryWindowRow,
    { message: string },
    string
  >({
    values: riderIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("rider_injuries")
        .select(
          "rider_id, started_at, expected_recovery_at, recovered_at",
        )
        .in("rider_id", chunk)
        .lte("started_at", latestDepartureAt)
        .gt("expected_recovery_at", earliestDepartureAt)
        .order("rider_id", { ascending: true })
        .order("started_at", { ascending: true })
        .range(from, to)
        .returns<RiderInjuryWindowRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(error, "les indisponibilites medicales des partants");

  return (data ?? []).map((row) => ({
    riderId: row.rider_id,
    startedAt: row.started_at,
    expectedRecoveryAt: row.expected_recovery_at,
    recoveredAt: row.recovered_at,
  }));
}

function getRepairableStageRaceEditions(
  calendar: SeasonRaceCalendar,
  now: Date,
) {
  const recentFinishThreshold =
    now.getTime() - RECENT_STAGE_RACE_REPAIR_WINDOW_MS;

  return calendar.editions.filter((edition) => {
    if (edition.raceFormat !== "stage_race" || edition.status === "cancelled") {
      return false;
    }

    const states = edition.stages.map((stage) =>
      getStageLiveState(stage, now),
    );
    const hasStarted = states.some(
      (state) => state.status === "live" || state.status === "finished",
    );
    if (!hasStarted) return false;

    const hasRemainingStage = states.some(
      (state) => state.status === "scheduled" || state.status === "live",
    );
    if (hasRemainingStage) return true;

    const latestFinishTimestamp = Math.max(
      ...states.flatMap((state) => {
        const timestamp = state.endsAt ? Date.parse(state.endsAt) : Number.NaN;
        return Number.isFinite(timestamp) ? [timestamp] : [];
      }),
    );
    return latestFinishTimestamp >= recentFinishThreshold;
  });
}

async function acquireOfficialSimulationClaim(
  stageId: string,
  raceEditionId: string,
) {
  const admin = createSupabaseAdminClient();
  const claimToken = randomUUID();
  const inserted = await admin
    .from("official_stage_simulation_claims")
    .insert({
      stage_id: stageId,
      race_edition_id: raceEditionId,
      claim_token: claimToken,
    })
    .select("claim_token, claimed_at")
    .single<OfficialSimulationClaimRow>();

  if (!inserted.error && inserted.data) return claimToken;
  if (inserted.error?.code !== "23505") {
    assertQuery(inserted.error, "la réservation du calcul officiel");
  }

  const existing = await admin
    .from("official_stage_simulation_claims")
    .select("claim_token, claimed_at")
    .eq("stage_id", stageId)
    .maybeSingle<OfficialSimulationClaimRow>();
  assertQuery(existing.error, "la réservation officielle en cours");
  if (!existing.data) return null;

  const staleBefore = new Date(
    Date.now() - OFFICIAL_SIMULATION_CLAIM_STALE_MS,
  ).toISOString();
  if (
    Date.parse(existing.data.claimed_at) >=
    Date.now() - OFFICIAL_SIMULATION_CLAIM_STALE_MS
  ) {
    return null;
  }

  const takeover = await admin
    .from("official_stage_simulation_claims")
    .update({
      race_edition_id: raceEditionId,
      claim_token: claimToken,
      claimed_at: new Date().toISOString(),
    })
    .eq("stage_id", stageId)
    .eq("claim_token", existing.data.claim_token)
    .lt("claimed_at", staleBefore)
    .select("claim_token, claimed_at")
    .maybeSingle<OfficialSimulationClaimRow>();
  assertQuery(takeover.error, "la reprise d’un calcul officiel interrompu");
  return takeover.data?.claim_token === claimToken ? claimToken : null;
}

async function waitForLockedSimulation(stageId: string) {
  const admin = createSupabaseAdminClient();

  for (
    let attempt = 0;
    attempt < OFFICIAL_SIMULATION_POLL_ATTEMPTS;
    attempt += 1
  ) {
    const existing = await admin
      .from("official_stage_simulations")
      .select(
        "stage_id, race_edition_id, engine_version, seed, input_data, simulation_data",
      )
      .eq("stage_id", stageId)
      .maybeSingle<OfficialStageSimulationRow>();
    assertQuery(existing.error, "le scénario officiel calculé en parallèle");
    if (existing.data) {
      return toLockedSimulation(existing.data);
    }

    if (attempt + 1 < OFFICIAL_SIMULATION_POLL_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, OFFICIAL_SIMULATION_POLL_DELAY_MS),
      );
    }
  }

  return null;
}

async function releaseOfficialSimulationClaim(
  stageId: string,
  claimToken: string,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("official_stage_simulation_claims")
    .delete()
    .eq("stage_id", stageId)
    .eq("claim_token", claimToken);

  if (error) {
    console.error(
      "Impossible de libérer la réservation du calcul officiel.",
      error,
    );
  }
}

async function insertOrReadLockedSimulation(
  candidate: LockedOfficialStageSimulation
) {
  const admin = createSupabaseAdminClient();
  const inserted = await admin
    .from("official_stage_simulations")
    .insert({
      stage_id: candidate.stageId,
      race_edition_id: candidate.raceEditionId,
      engine_version: candidate.engineVersion,
      seed: candidate.seed,
      input_data: candidate.input,
      simulation_data: candidate.simulation,
    })
    .select(
      "stage_id, race_edition_id, engine_version, seed, input_data, simulation_data"
    )
    .single<OfficialStageSimulationRow>();

  if (!inserted.error && inserted.data) {
    return toLockedSimulation(inserted.data);
  }
  if (inserted.error?.code !== "23505") {
    assertQuery(inserted.error, "le verrouillage du scénario officiel");
  }

  const existing = await admin
    .from("official_stage_simulations")
    .select(
      "stage_id, race_edition_id, engine_version, seed, input_data, simulation_data"
    )
    .eq("stage_id", candidate.stageId)
    .single<OfficialStageSimulationRow>();
  assertQuery(existing.error, "le scénario officiel verrouillé en parallèle");
  return toLockedSimulation(existing.data!);
}

function toLockedSimulation(
  row: OfficialStageSimulationRow
): LockedOfficialStageSimulation {
  return {
    stageId: row.stage_id,
    raceEditionId: row.race_edition_id,
    engineVersion: row.engine_version,
    seed: row.seed,
    input: row.input_data,
    simulation: normalizeOfficialStageResultRanks(row.simulation_data),
  };
}

function assertQuery(
  error: { message: string } | null,
  subject: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${subject} : ${error.message}`);
  }
}
