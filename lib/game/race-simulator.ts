import type { RaceProfileType } from "./race-calendar";
import type {
  RiderSimulationInput,
  RiderSimulationRatings,
  SimulationStageType,
  StageSimulationInput,
  StageSimulationResult,
} from "./race-simulation";
import type { RaceStageSegment } from "./race-profiles";

export type RaceSimulatorStageOption = {
  id: string;
  editionId: string;
  editionName: string;
  stageName: string;
  label: string;
  stageNumber: number;
  stageType: SimulationStageType;
  profileType: RaceProfileType;
  distanceKm: number;
  isStageRace: boolean;
  segments: RaceStageSegment[];
};

export type RaceSimulatorRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  age: number;
  form: number;
  ratings: RiderSimulationRatings;
  specialAbilities: RiderSimulationInput["specialAbilities"];
};

export type RaceSimulatorTeam = {
  id: string;
  name: string;
  kind: "team" | "free_agent_pool";
  primaryColor: string;
  secondaryColor: string;
  riders: RaceSimulatorRider[];
};

export const RACE_SIMULATOR_LOG_TYPES = [
  "setup",
  "segment",
  "event",
  "group",
  "incident",
  "prime",
  "result",
] as const;

export type RaceSimulatorLogType =
  (typeof RACE_SIMULATOR_LOG_TYPES)[number];

export type RaceSimulatorLogEntry = {
  id: string;
  sequence: number;
  segmentNumber: number | null;
  completedDistanceKm: number | null;
  type: RaceSimulatorLogType;
  title: string;
  message: string;
};

export type RaceSimulatorResultRow = {
  riderId: string;
  riderName: string;
  teamId: string;
  teamName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  role: RiderSimulationInput["role"];
  rank: number | null;
  status: StageSimulationResult["results"][number]["status"];
  elapsedTimeSeconds: number;
  gapToWinnerSeconds: number;
  energyAfter: number;
  form: number;
  overallNote: number;
  profileNote: number;
  ratings: RiderSimulationRatings;
  injuryLabel: string | null;
};

export type RaceSimulatorRun = {
  simulationId: string;
  stageId: string;
  stageName: string;
  stageType: SimulationStageType;
  seed: string;
  distanceKm: number;
  segmentCount: number;
  riderCount: number;
  teamCount: number;
  results: RaceSimulatorResultRow[];
  logs: RaceSimulatorLogEntry[];
};

export type RaceSimulatorActionState = {
  status: "idle" | "success" | "error" | "forbidden";
  message: string;
  run: RaceSimulatorRun | null;
};

export const INITIAL_RACE_SIMULATOR_STATE: RaceSimulatorActionState = {
  status: "idle",
  message: "",
  run: null,
};

export function getRaceSimulationProfileNote({
  rider,
  segments,
  stageType,
  profileType,
}: {
  rider: RiderSimulationInput;
  segments: RaceStageSegment[];
  stageType: SimulationStageType;
  profileType: RaceProfileType;
}) {
  const distance = Math.max(
    1,
    segments.reduce((total, segment) => total + segment.distanceKm, 0)
  );
  const isTimeTrial =
    stageType === "individual_time_trial" ||
    stageType === "team_time_trial" ||
    stageType === "prologue";

  const weightedScore = segments.reduce((total, segment) => {
    const terrainRating = getTerrainRating(rider, segment);
    const segmentRating = isTimeTrial
      ? (stageType === "prologue"
          ? rider.ratings.prologue
          : rider.ratings.timeTrial) *
          0.58 +
        terrainRating * 0.27 +
        rider.ratings.endurance * 0.1 +
        rider.form * 0.05
      : profileType === "hilly"
        ? rider.ratings.hills * 0.5 +
          rider.ratings.acceleration * 0.22 +
          rider.ratings.resistance * 0.1 +
          rider.ratings.endurance * 0.1 +
          rider.form * 0.08
        : terrainRating * 0.75 +
        rider.ratings.endurance * 0.15 +
        rider.form * 0.1;

    return total + segmentRating * segment.distanceKm;
  }, 0);

  return round(weightedScore / distance, 1);
}

export function getRaceSimulationOverallNote(
  ratings: RiderSimulationRatings
) {
  const values = Object.values(ratings);
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

export function buildRaceSimulatorLogs(
  input: StageSimulationInput,
  simulation: StageSimulationResult
): RaceSimulatorLogEntry[] {
  const logs: RaceSimulatorLogEntry[] = [];
  const riderById = new Map(
    simulation.resolvedRiders.map((rider) => [rider.id, rider])
  );
  let sequence = 0;

  const push = (
    entry: Omit<RaceSimulatorLogEntry, "id" | "sequence">
  ) => {
    sequence += 1;
    logs.push({
      ...entry,
      id: `log-${sequence}`,
      sequence,
    });
  };

  push({
    segmentNumber: null,
    completedDistanceKm: 0,
    type: "setup",
    title: "Initialisation du moteur",
    message: `${input.riders.length} coureurs, ${new Set(input.riders.map((rider) => rider.teamId)).size} équipes, ${input.segments.length} tronçons. Graine déterministe : ${simulation.seed}.`,
  });

  push({
    segmentNumber: null,
    completedDistanceKm: 0,
    type: "setup",
    title: "Rôles résolus",
    message: simulation.resolvedRiders
      .map((rider) => `${rider.name} (${rider.teamName}) : ${rider.role}`)
      .join(" · "),
  });

  for (const snapshot of simulation.timeline) {
    const segment = input.segments.find(
      (candidate) => candidate.segmentNumber === snapshot.segmentNumber
    );

    push({
      segmentNumber: snapshot.segmentNumber,
      completedDistanceKm: snapshot.completedDistanceKm,
      type: "segment",
      title: `Tronçon ${snapshot.segmentNumber}`,
      message: segment
        ? `${formatTerrain(segment)} · ${formatNumber(segment.distanceKm)} km · pente ${formatSignedNumber(segment.averageGradientPct)} %${segment.surface === "cobbles" ? " · pavés" : ""}.`
        : `Distance cumulée : ${formatNumber(snapshot.completedDistanceKm)} km.`,
    });

    for (const message of snapshot.commentary) {
      push({
        segmentNumber: snapshot.segmentNumber,
        completedDistanceKm: snapshot.completedDistanceKm,
        type: "event",
        title: "Événement moteur",
        message,
      });
    }

    for (const incident of snapshot.incidents) {
      push({
        segmentNumber: snapshot.segmentNumber,
        completedDistanceKm: snapshot.completedDistanceKm,
        type: "incident",
        title: incident.label,
        message: `${formatRiderNames(incident.riderIds, riderById)}${incident.abandonedRiderIds.length > 0 ? ` · abandon : ${formatRiderNames(incident.abandonedRiderIds, riderById)}` : ""}.`,
      });
    }

    const prime = simulation.primes.find(
      (candidate) => candidate.segmentNumber === snapshot.segmentNumber
    );
    if (prime) {
      push({
        segmentNumber: snapshot.segmentNumber,
        completedDistanceKm: snapshot.completedDistanceKm,
        type: "prime",
        title:
          prime.prime.type === "mountain"
            ? `Grand Prix de la montagne${prime.prime.category ? ` ${prime.prime.category}` : ""}`
            : "Sprint intermédiaire",
        message: prime.classification
          .map(
            (classified) =>
              `${classified.rank}. ${riderById.get(classified.riderId)?.name ?? classified.riderId} (+${classified.points})`
          )
          .join(" · "),
      });
    }

    for (const group of snapshot.groups) {
      push({
        segmentNumber: snapshot.segmentNumber,
        completedDistanceKm: snapshot.completedDistanceKm,
        type: "group",
        title: group.label,
        message: `${group.riderIds.length} coureur${group.riderIds.length > 1 ? "s" : ""} · écart ${formatGap(group.gapToLeaderSeconds)} · énergie moyenne ${formatNumber(group.averageEnergy)} · ${formatRiderNames(group.riderIds, riderById)}.`,
      });
    }
  }

  const winner = simulation.results.find((result) => result.rank === 1);
  const winnerRider = winner ? riderById.get(winner.riderId) : null;
  push({
    segmentNumber: null,
    completedDistanceKm: input.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0
    ),
    type: "result",
    title: "Résultat final",
    message: winner
      ? `${winnerRider?.name ?? winner.riderId} (${winnerRider?.teamName ?? "équipe inconnue"}) remporte la simulation en ${formatDuration(winner.elapsedTimeSeconds)}. ${simulation.results.filter((result) => result.status === "did_not_finish").length} abandon(s).`
      : "Aucun vainqueur n’a été produit par le moteur.",
  });

  return logs;
}

function getTerrainRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment
) {
  let rating: number;

  if (segment.terrain === "climb") {
    const longSteepClimb = Math.abs(segment.averageGradientPct) >= 6;
    rating = longSteepClimb
      ? rider.ratings.mountain * 0.72 + rider.ratings.hills * 0.28
      : rider.ratings.hills * 0.82 + rider.ratings.mountain * 0.18;
  } else if (segment.terrain === "descent") {
    rating = rider.ratings.downhill * 0.72 + rider.ratings.resistance * 0.28;
  } else {
    rating = rider.ratings.flat;
  }

  if (segment.surface === "cobbles") {
    rating = rating * 0.36 + rider.ratings.cobbles * 0.64;
  }

  return rating;
}

function formatRiderNames(
  riderIds: string[],
  riderById: Map<string, RiderSimulationInput>
) {
  const names = riderIds.map(
    (riderId) => riderById.get(riderId)?.name ?? riderId
  );

  if (names.length <= 8) return names.join(", ");
  return `${names.slice(0, 8).join(", ")} et ${names.length - 8} autre${names.length - 8 > 1 ? "s" : ""}`;
}

function formatTerrain(segment: RaceStageSegment) {
  if (segment.terrain === "climb") return "Montée";
  if (segment.terrain === "descent") return "Descente";
  return "Plaine";
}

function formatGap(value: number) {
  if (value <= 0) return "tête de course";
  return `+${Math.round(value)} s`;
}

function formatDuration(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const seconds = rounded % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min ${String(seconds).padStart(2, "0")} s`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
