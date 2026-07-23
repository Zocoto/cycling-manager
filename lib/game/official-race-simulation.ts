import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
import { createCalendarSimulationInput } from "./race-simulation-demo";
import {
  buildStageRaceStandings,
  simulateRaceStage,
  type StageRaceStandings,
  type StageSimulationInput,
  type StageSimulationResult,
} from "./race-simulation";

export type OfficialStageSimulationRun = {
  stage: RaceCalendarStage;
  input: StageSimulationInput;
  simulation: StageSimulationResult;
};

export type OfficialStageSimulationContext = OfficialStageSimulationRun & {
  standings: StageRaceStandings | null;
};

export const OFFICIAL_RACE_ENGINE_VERSION = "2026.07-synchronized-v2";

export type LockedOfficialStageSimulation = {
  stageId: string;
  raceEditionId: string;
  engineVersion: string;
  seed: string;
  input: StageSimulationInput;
  simulation: StageSimulationResult;
};

export type LockedOfficialRaceSimulationDirectory = Record<
  string,
  LockedOfficialStageSimulation[]
>;

export function isUnavailableForFollowingStage(
  result: StageSimulationResult["results"][number]
) {
  return result.status === "did_not_finish" || result.injury !== null;
}

/**
 * Produit une seule chronologie canonique pour une édition entière. Le live,
 * le replay et la consolidation serveur utilisent cette fonction afin que la
 * liste des partants des étapes suivantes et tous les tirages restent alignés.
 */
export function simulateOfficialRaceEdition(
  edition: RaceCalendarEdition
): OfficialStageSimulationRun[] {
  const unavailableRiderIds = new Set<string>();
  const orderedStages = [...edition.stages].sort(
    (first, second) =>
      first.stageNumber - second.stageNumber ||
      first.id.localeCompare(second.id)
  );

  return orderedStages.map((stage) => {
    const input = createCalendarSimulationInput({
      edition,
      stage,
      seed: `${edition.id}:${stage.id}:official`,
    });
    const simulation = simulateRaceStage({
      ...input,
      unavailableRiderIds: [...unavailableRiderIds].sort(),
    });

    for (const result of simulation.results) {
      if (isUnavailableForFollowingStage(result)) {
        unavailableRiderIds.add(result.riderId);
      }
    }

    return { stage, input, simulation };
  });
}

export function getOfficialStageSimulationContext({
  edition,
  stageId,
  lockedSimulations = [],
}: {
  edition: RaceCalendarEdition;
  stageId: string;
  lockedSimulations?: LockedOfficialStageSimulation[];
}): OfficialStageSimulationContext {
  const lockedByStageId = new Map(
    lockedSimulations.map((simulation) => [
      simulation.stageId,
      simulation,
    ])
  );
  const selectedLockedSimulation = lockedByStageId.get(stageId);

  if (selectedLockedSimulation) {
    const orderedStages = [...edition.stages].sort(
      (first, second) =>
        first.stageNumber - second.stageNumber ||
        first.id.localeCompare(second.id)
    );
    const selectedIndex = orderedStages.findIndex(
      (stage) => stage.id === stageId
    );
    const stage = orderedStages[selectedIndex];
    if (!stage) {
      throw new Error(
        `L'étape ${stageId} n'appartient pas à l'édition ${edition.id}.`
      );
    }
    const simulationsThroughStage = orderedStages
      .slice(0, selectedIndex + 1)
      .map((candidateStage) => lockedByStageId.get(candidateStage.id))
      .filter(
        (
          simulation
        ): simulation is LockedOfficialStageSimulation =>
          simulation !== undefined
      );

    return {
      stage,
      input: selectedLockedSimulation.input,
      simulation: selectedLockedSimulation.simulation,
      standings:
        edition.raceFormat === "stage_race"
          ? buildStageRaceStandings(
              simulationsThroughStage.map(
                (lockedSimulation) => lockedSimulation.simulation
              )
            )
          : null,
    };
  }

  const runs = simulateOfficialRaceEdition(edition);
  const selectedIndex = runs.findIndex((run) => run.stage.id === stageId);

  if (selectedIndex < 0) {
    throw new Error(
      `L'étape ${stageId} n'appartient pas à l'édition ${edition.id}.`
    );
  }

  const selectedRun = runs[selectedIndex];
  return {
    ...selectedRun,
    standings:
      edition.raceFormat === "stage_race"
        ? buildStageRaceStandings(
            runs
              .slice(0, selectedIndex + 1)
              .map((run) => run.simulation)
          )
        : null,
  };
}
