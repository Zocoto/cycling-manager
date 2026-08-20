import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  RaceFormat,
} from "./race-calendar";
import { createCalendarSimulationInput } from "./race-simulation-demo";
import { removeOneDayRaceMountainPrimes } from "./race-profiles";
import {
  assignStageRaceJerseys,
  getStageRaceJerseyByRiderId,
  getStageRaceJerseyVisuals,
} from "./stage-race-jerseys";
import {
  buildStageRaceStandings,
  getMountainObjectiveRiderIdsByTeam,
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
  standingsBeforeStage: StageRaceStandings | null;
};

export const OFFICIAL_RACE_ENGINE_VERSION =
  "2026.08-race-variance-injury-v13";

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

export function sanitizeOfficialStageSimulationForRaceFormat({
  raceFormat,
  input,
  simulation,
}: {
  raceFormat: RaceFormat;
  input: StageSimulationInput;
  simulation: StageSimulationResult;
}) {
  if (raceFormat !== "one_day") {
    return { input, simulation };
  }

  const segments = removeOneDayRaceMountainPrimes(input.segments, raceFormat);
  const primes = simulation.primes.filter(
    (prime) => prime.prime.type !== "mountain",
  );
  const sanitizedInput =
    segments === input.segments ? input : { ...input, segments };
  const sanitizedSimulation =
    primes.length === simulation.primes.length &&
    Object.keys(simulation.mountainPoints).length === 0
      ? simulation
      : {
          ...simulation,
          primes,
          mountainPoints: {},
        };

  return {
    input: sanitizedInput,
    simulation: sanitizedSimulation,
  };
}

function hydrateLockedRiderVisualMetadata({
  edition,
  input,
  simulation,
}: {
  edition: RaceCalendarEdition;
  input: StageSimulationInput;
  simulation: StageSimulationResult;
}) {
  const metadataByRiderId = new Map(
    edition.engagedRiders.map((rider) => [rider.id, rider]),
  );
  const hydrateRider = (rider: StageSimulationInput["riders"][number]) => {
    const current = metadataByRiderId.get(rider.id);
    if (!current) return rider;
    const avatarProfileKey = current.avatarProfileKey ?? rider.avatarProfileKey;
    const avatarSeed = current.avatarSeed ?? rider.avatarSeed;
    const nationalChampionships =
      current.nationalChampionships ?? rider.nationalChampionships;
    const shouldHydrateTeamJersey =
      !rider.teamJersey && current.teamJersey !== undefined;
    const teamJersey = rider.teamJersey ?? current.teamJersey;
    const teamPrimaryColor = shouldHydrateTeamJersey
      ? current.teamPrimaryColor
      : rider.teamPrimaryColor;
    const teamSecondaryColor = shouldHydrateTeamJersey
      ? current.teamSecondaryColor
      : rider.teamSecondaryColor;
    if (
      avatarProfileKey === rider.avatarProfileKey &&
      avatarSeed === rider.avatarSeed &&
      nationalChampionships === rider.nationalChampionships &&
      teamJersey === rider.teamJersey &&
      teamPrimaryColor === rider.teamPrimaryColor &&
      teamSecondaryColor === rider.teamSecondaryColor
    ) {
      return rider;
    }
    return {
      ...rider,
      avatarProfileKey,
      avatarSeed,
      nationalChampionships,
      teamPrimaryColor,
      teamSecondaryColor,
      ...(teamJersey ? { teamJersey } : {}),
    };
  };

  const hydratedInputRiders = input.riders.map(hydrateRider);
  const hydratedResolvedRiders = simulation.resolvedRiders.map(hydrateRider);
  const inputChanged = hydratedInputRiders.some(
    (rider, index) => rider !== input.riders[index],
  );
  const simulationChanged = hydratedResolvedRiders.some(
    (rider, index) => rider !== simulation.resolvedRiders[index],
  );

  return {
    input: inputChanged ? { ...input, riders: hydratedInputRiders } : input,
    simulation: simulationChanged
      ? { ...simulation, resolvedRiders: hydratedResolvedRiders }
      : simulation,
  };
}

function decorateStageRaceJerseys({
  edition,
  stage,
  input,
  simulation,
  standingsBeforeStage,
}: {
  edition: Pick<RaceCalendarEdition, "countryCode" | "isGrandTour">;
  stage: RaceCalendarStage;
  input: StageSimulationInput;
  simulation: StageSimulationResult;
  standingsBeforeStage: StageRaceStandings | null;
}) {
  const jerseyVisuals = getStageRaceJerseyVisuals(edition);
  const classificationJerseyByRiderId = getStageRaceJerseyByRiderId(
    assignStageRaceJerseys(standingsBeforeStage),
  );
  const nationalChampionshipDiscipline =
    stage.stageType === "individual_time_trial" ||
    stage.stageType === "prologue"
      ? "time_trial"
      : "road";
  const decorateRider = (rider: StageSimulationInput["riders"][number]) => {
    const classificationJersey =
      classificationJerseyByRiderId.get(rider.id) ?? null;
    const classificationJerseyVisual = classificationJersey
      ? jerseyVisuals[classificationJersey]
      : null;
    const activeNationalChampion =
      rider.nationalChampionships?.[nationalChampionshipDiscipline] ?? null;
    const activeContinentalChampion =
      rider.continentalChampionships?.[nationalChampionshipDiscipline] ?? null;
    const activeWorldChampion =
      rider.worldChampionships?.[nationalChampionshipDiscipline] ?? null;
    if (
      classificationJersey === (rider.classificationJersey ?? null) &&
      classificationJerseyVisual ===
        (rider.classificationJerseyVisual ?? null) &&
      activeNationalChampion === (rider.activeNationalChampion ?? null) &&
      activeWorldChampion === (rider.activeWorldChampion ?? null) &&
      activeContinentalChampion === (rider.activeContinentalChampion ?? null)
    ) {
      return rider;
    }
    return {
      ...rider,
      classificationJersey,
      classificationJerseyVisual,
      activeNationalChampion,
      activeWorldChampion,
      activeContinentalChampion,
    };
  };
  const decoratedInputRiders = input.riders.map(decorateRider);
  const decoratedResolvedRiders = simulation.resolvedRiders.map(decorateRider);
  const inputChanged = decoratedInputRiders.some(
    (rider, index) => rider !== input.riders[index],
  );
  const simulationChanged = decoratedResolvedRiders.some(
    (rider, index) => rider !== simulation.resolvedRiders[index],
  );

  return {
    input: inputChanged ? { ...input, riders: decoratedInputRiders } : input,
    simulation: simulationChanged
      ? { ...simulation, resolvedRiders: decoratedResolvedRiders }
      : simulation,
  };
}

export function isUnavailableForFollowingStage(
  result: StageSimulationResult["results"][number],
) {
  return result.status !== "finished" || result.injury !== null;
}

export function simulationStartsUnavailableRider(
  simulation: Pick<StageSimulationResult, "results">,
  unavailableRiderIds: ReadonlySet<string>,
) {
  return simulation.results.some((result) =>
    unavailableRiderIds.has(result.riderId),
  );
}

/**
 * Produit une seule chronologie canonique pour une édition entière. Le live,
 * le replay et la consolidation serveur utilisent cette fonction afin que la
 * liste des partants des étapes suivantes et tous les tirages restent alignés.
 */
export function simulateOfficialRaceEdition(
  edition: RaceCalendarEdition,
): OfficialStageSimulationRun[] {
  const unavailableRiderIds = new Set<string>();
  const orderedStages = [...edition.stages].sort(
    (first, second) =>
      first.stageNumber - second.stageNumber ||
      first.id.localeCompare(second.id),
  );

  const runs: OfficialStageSimulationRun[] = [];

  for (const stage of orderedStages) {
    const standingsBeforeStage =
      edition.raceFormat === "stage_race" && runs.length > 0
        ? buildStageRaceStandings(runs.map((run) => run.simulation))
        : null;
    const baseInput = createCalendarSimulationInput({
      edition,
      stage,
      seed: edition.id + ":" + stage.id + ":official",
    });
    const mountainObjectiveRiderIds = getMountainObjectiveRiderIdsByTeam(
      runs.at(-1)?.simulation.resolvedRiders ?? [],
    );
    const input: StageSimulationInput = {
      ...baseInput,
      generalClassification: standingsBeforeStage?.general,
      unavailableRiderIds: [...unavailableRiderIds].sort(),
      ...(Object.keys(mountainObjectiveRiderIds).length > 0
        ? { mountainObjectiveRiderIds }
        : {}),
    };
    const simulation = simulateRaceStage(input);

    for (const result of simulation.results) {
      if (isUnavailableForFollowingStage(result)) {
        unavailableRiderIds.add(result.riderId);
      }
    }

    runs.push({ stage, input, simulation });
  }

  return runs;
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
    lockedSimulations.map((simulation) => [simulation.stageId, simulation]),
  );
  const selectedLockedSimulation = lockedByStageId.get(stageId);

  if (selectedLockedSimulation) {
    const orderedStages = [...edition.stages].sort(
      (first, second) =>
        first.stageNumber - second.stageNumber ||
        first.id.localeCompare(second.id),
    );
    const selectedIndex = orderedStages.findIndex(
      (stage) => stage.id === stageId,
    );
    const stage = orderedStages[selectedIndex];
    if (!stage) {
      throw new Error(
        `L'étape ${stageId} n'appartient pas à l'édition ${edition.id}.`,
      );
    }
    const simulationsThroughStage = orderedStages
      .slice(0, selectedIndex + 1)
      .map((candidateStage) => lockedByStageId.get(candidateStage.id))
      .filter(
        (simulation): simulation is LockedOfficialStageSimulation =>
          simulation !== undefined,
      );
    const simulationsBeforeStage = orderedStages
      .slice(0, selectedIndex)
      .map((candidateStage) => lockedByStageId.get(candidateStage.id))
      .filter(
        (simulation): simulation is LockedOfficialStageSimulation =>
          simulation !== undefined,
      );
    const standingsBeforeStage =
      edition.raceFormat === "stage_race" && simulationsBeforeStage.length > 0
        ? buildStageRaceStandings(
            simulationsBeforeStage.map(
              (lockedSimulation) => lockedSimulation.simulation,
            ),
          )
        : null;

    const sanitizedLockedSimulationData =
      sanitizeOfficialStageSimulationForRaceFormat({
        raceFormat: edition.raceFormat,
        input: selectedLockedSimulation.input,
        simulation: selectedLockedSimulation.simulation,
      });

    const hydratedLockedSimulationData = hydrateLockedRiderVisualMetadata({
      edition,
      input: sanitizedLockedSimulationData.input,
      simulation: sanitizedLockedSimulationData.simulation,
    });

    const decoratedLockedSimulationData = decorateStageRaceJerseys({
      edition,
      stage,
      input: hydratedLockedSimulationData.input,
      simulation: hydratedLockedSimulationData.simulation,
      standingsBeforeStage,
    });

    return {
      stage,
      input: decoratedLockedSimulationData.input,
      simulation: decoratedLockedSimulationData.simulation,
      standings:
        edition.raceFormat === "stage_race"
          ? buildStageRaceStandings(
              simulationsThroughStage.map(
                (lockedSimulation) => lockedSimulation.simulation,
              ),
            )
          : null,
      standingsBeforeStage,
    };
  }

  const runs = simulateOfficialRaceEdition(edition);
  const selectedIndex = runs.findIndex((run) => run.stage.id === stageId);

  if (selectedIndex < 0) {
    throw new Error(
      `L'étape ${stageId} n'appartient pas à l'édition ${edition.id}.`,
    );
  }

  const selectedRun = runs[selectedIndex];
  const standingsBeforeStage =
    edition.raceFormat === "stage_race" && selectedIndex > 0
      ? buildStageRaceStandings(
          runs.slice(0, selectedIndex).map((run) => run.simulation),
        )
      : null;
  const decoratedSelectedRun = decorateStageRaceJerseys({
    edition,
    stage: selectedRun.stage,
    input: selectedRun.input,
    simulation: selectedRun.simulation,
    standingsBeforeStage,
  });

  return {
    ...selectedRun,
    input: decoratedSelectedRun.input,
    simulation: decoratedSelectedRun.simulation,
    standings:
      edition.raceFormat === "stage_race"
        ? buildStageRaceStandings(
            runs.slice(0, selectedIndex + 1).map((run) => run.simulation),
          )
        : null,
    standingsBeforeStage,
  };
}
