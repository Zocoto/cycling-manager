import "server-only";

import { randomUUID } from "node:crypto";

import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  isUnavailableForFollowingStage,
  OFFICIAL_RACE_ENGINE_VERSION,
  simulationStartsUnavailableRider,
  type LockedOfficialRaceSimulationDirectory,
  type LockedOfficialStageSimulation,
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

const OFFICIAL_SIMULATION_CLAIM_STALE_MS = 120_000;
const OFFICIAL_SIMULATION_POLL_ATTEMPTS = 20;
const OFFICIAL_SIMULATION_POLL_DELAY_MS = 75;

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
      let lockedSimulation = lockedByStageId.get(stage.id) ?? null;
      const startsUnavailableRider = lockedSimulation
        ? simulationStartsUnavailableRider(
            lockedSimulation.simulation,
            unavailableRiderIds,
          )
        : false;

      if (!lockedSimulation || startsUnavailableRider) {
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
          lockedSimulation = await waitForLockedSimulation(
            stage.id,
            unavailableRiderIds,
          );
          if (!lockedSimulation) break;
          lockedByStageId.set(stage.id, lockedSimulation);
        } else {
          try {
            if (startsUnavailableRider) {
              console.warn(
                `Le scénario officiel de l'étape ${stage.stageNumber} fait repartir un coureur indisponible : recalcul automatique.`,
              );
              const { error: staleSimulationError } = await admin
                .from("official_stage_simulations")
                .delete()
                .eq("stage_id", stage.id);
              assertQuery(
                staleSimulationError,
                "le remplacement d’un scénario officiel incohérent",
              );
              lockedByStageId.delete(stage.id);
            }
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
            const simulation = simulateRaceStage(officialInput);
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

async function waitForLockedSimulation(
  stageId: string,
  unavailableRiderIds: ReadonlySet<string>,
) {
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
      const locked = toLockedSimulation(existing.data);
      if (
        !simulationStartsUnavailableRider(
          locked.simulation,
          unavailableRiderIds,
        )
      ) {
        return locked;
      }
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
    simulation: row.simulation_data,
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
