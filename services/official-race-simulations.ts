import "server-only";

import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  isUnavailableForFollowingStage,
  OFFICIAL_RACE_ENGINE_VERSION,
  type LockedOfficialRaceSimulationDirectory,
  type LockedOfficialStageSimulation,
} from "@/lib/game/official-race-simulation";
import { createCalendarSimulationInput } from "@/lib/game/race-simulation-demo";
import {
  simulateRaceStage,
  type StageSimulationInput,
  type StageSimulationResult,
} from "@/lib/game/race-simulation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OfficialStageSimulationRow = {
  stage_id: string;
  race_edition_id: string;
  engine_version: string;
  seed: string;
  input_data: StageSimulationInput;
  simulation_data: StageSimulationResult;
};

export async function ensureLockedOfficialRaceSimulations(
  calendar: SeasonRaceCalendar,
  now = new Date()
): Promise<LockedOfficialRaceSimulationDirectory> {
  const admin = createSupabaseAdminClient();
  const stageIds = calendar.editions.flatMap((edition) =>
    edition.stages.map((stage) => stage.id)
  );
  if (stageIds.length === 0) return {};

  const { data, error } = await admin
    .from("official_stage_simulations")
    .select(
      "stage_id, race_edition_id, engine_version, seed, input_data, simulation_data"
    )
    .in("stage_id", stageIds)
    .returns<OfficialStageSimulationRow[]>();
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

      if (!lockedSimulation) {
        const liveState = getStageLiveState(stage, now);
        if (
          liveState.status === "scheduled" ||
          liveState.status === "cancelled" ||
          edition.engagedRiders.length === 0
        ) {
          break;
        }

        const input = createCalendarSimulationInput({
          edition,
          stage,
          seed: `${edition.id}:${stage.id}:official`,
        });
        const officialInput: StageSimulationInput = {
          ...input,
          unavailableRiderIds: [...unavailableRiderIds].sort(),
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
        lockedSimulation = await insertOrReadLockedSimulation(
          candidate
        );
        lockedByStageId.set(stage.id, lockedSimulation);
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
