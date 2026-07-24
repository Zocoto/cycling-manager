import {
  buildRaceSimulatorLogs,
  getRaceSimulationOverallNote,
  getRaceSimulationProfileNote,
  type RaceSimulatorRun,
} from "@/lib/game/race-simulator";
import {
  type RiderSimulationInput,
  type RiderSimulationRatings,
  type RiderSpecialAbility,
  type StageSimulationInput,
  type StageSimulationResult,
} from "@/lib/game/race-simulation";
import type { RaceStageSegment } from "@/lib/game/race-profiles";

export const TUTORIAL_RACE_KEY = "tutorial-race";
export const TUTORIAL_RACE_ROUTE = "/jeu/course-initiation";
export const TUTORIAL_RACE_VERSION = 1;
export const TUTORIAL_RACE_SELECTION_SIZE = 5;

export type TutorialRaceRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  countryName: string;
  age: number;
  ratings: RiderSimulationRatings;
};

export const TUTORIAL_RACE_SEGMENTS: readonly RaceStageSegment[] = [
  {
    segmentNumber: 1,
    distanceKm: 20,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime: null,
  },
  {
    segmentNumber: 2,
    distanceKm: 20,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime: {
      type: "intermediate_sprint",
      category: null,
      pointsScale: [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    },
  },
  {
    segmentNumber: 3,
    distanceKm: 20,
    terrain: "climb",
    averageGradientPct: 4.2,
    surface: "asphalt",
    prime: {
      type: "mountain",
      category: "4",
      pointsScale: [1],
    },
  },
  {
    segmentNumber: 4,
    distanceKm: 20,
    terrain: "descent",
    averageGradientPct: -4.6,
    surface: "asphalt",
    prime: null,
  },
  {
    segmentNumber: 5,
    distanceKm: 20,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "cobbles",
    prime: null,
  },
  {
    segmentNumber: 6,
    distanceKm: 20,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime: null,
  },
];

export function createTutorialRaceSeed(
  sportingDirectorId: string,
): string {
  return `tutorial-race:v${TUTORIAL_RACE_VERSION}:${sportingDirectorId}`;
}

export function isTutorialRaceSelectionValid(
  riderIds: readonly string[],
): boolean {
  return (
    riderIds.length === TUTORIAL_RACE_SELECTION_SIZE &&
    new Set(riderIds).size === TUTORIAL_RACE_SELECTION_SIZE
  );
}

export function createTutorialRaceSimulationInput({
  selectedRiders,
  teamId,
  teamName,
  teamPrimaryColor,
  teamSecondaryColor,
  seed,
}: {
  selectedRiders: readonly TutorialRaceRider[];
  teamId: string;
  teamName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  seed: string;
}): StageSimulationInput {
  if (
    !isTutorialRaceSelectionValid(
      selectedRiders.map((rider) => rider.id),
    )
  ) {
    throw new Error(
      `Sélectionnez exactement ${TUTORIAL_RACE_SELECTION_SIZE} coureurs différents.`,
    );
  }

  const playerRiders: RiderSimulationInput[] =
    selectedRiders.map((rider) => ({
      id: rider.id,
      name: `${rider.firstName} ${rider.lastName}`.trim(),
      teamId,
      teamName,
      teamPrimaryColor,
      teamSecondaryColor,
      countryCode: rider.countryCode,
      age: rider.age,
      form: 78,
      role: "auto",
      ratings: { ...rider.ratings },
    }));

  return {
    id: TUTORIAL_RACE_KEY,
    name: "Critérium de découverte",
    stageType: "road",
    profileType: "mixed",
    raceCountryCode: "FR",
    isStageRace: false,
    seed,
    segments: TUTORIAL_RACE_SEGMENTS.map((segment) => ({
      ...segment,
      prime: segment.prime
        ? {
            ...segment.prime,
            pointsScale: [...segment.prime.pointsScale],
          }
        : null,
    })),
    riders: [
      ...playerRiders,
      ...TUTORIAL_RACE_OPPONENTS.map((rider) => ({
        ...rider,
        ratings: { ...rider.ratings },
        specialAbilities: [
          ...(rider.specialAbilities ?? []),
        ],
      })),
    ],
  };
}

export function buildTutorialRaceRun(
  input: StageSimulationInput,
  simulation: StageSimulationResult,
): RaceSimulatorRun {
  const riderById = new Map(
    simulation.resolvedRiders.map((rider) => [
      rider.id,
      rider,
    ]),
  );

  return {
    simulationId: `${TUTORIAL_RACE_KEY}:${simulation.seed}`,
    stageId: TUTORIAL_RACE_KEY,
    stageName: input.name,
    stageType: input.stageType,
    seed: simulation.seed,
    distanceKm: input.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
    segmentCount: input.segments.length,
    riderCount: simulation.resolvedRiders.length,
    teamCount: new Set(
      simulation.resolvedRiders.map(
        (rider) => rider.teamId,
      ),
    ).size,
    results: simulation.results.map((result) => {
      const rider = riderById.get(result.riderId);

      if (!rider) {
        throw new Error(
          `Le moteur a renvoyé un coureur inconnu : ${result.riderId}.`,
        );
      }

      return {
        riderId: rider.id,
        riderName: rider.name,
        teamId: rider.teamId,
        teamName: rider.teamName,
        teamPrimaryColor: rider.teamPrimaryColor,
        teamSecondaryColor: rider.teamSecondaryColor,
        role: rider.role,
        rank: result.rank,
        status: result.status,
        elapsedTimeSeconds: result.elapsedTimeSeconds,
        gapToWinnerSeconds: result.gapToWinnerSeconds,
        energyAfter: result.energyAfter,
        form: rider.form,
        overallNote: getRaceSimulationOverallNote(
          rider.ratings,
        ),
        profileNote: getRaceSimulationProfileNote({
          rider,
          segments: input.segments,
          stageType: input.stageType,
          profileType: input.profileType,
        }),
        ratings: rider.ratings,
        injuryLabel: result.injury?.label ?? null,
      };
    }),
    logs: buildRaceSimulatorLogs(input, simulation),
  };
}

export function getTutorialRaceRunFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): RaceSimulatorRun | null {
  const candidate = metadata?.raceRun;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !Array.isArray(
      (candidate as { results?: unknown }).results,
    ) ||
    !Array.isArray(
      (candidate as { logs?: unknown }).logs,
    )
  ) {
    return null;
  }

  return candidate as RaceSimulatorRun;
}

export function getTutorialRaceSelectionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const candidate = metadata?.selectedRiderIds;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter(
    (value): value is string =>
      typeof value === "string",
  );
}

function ratings(
  overrides: Partial<RiderSimulationRatings>,
): RiderSimulationRatings {
  return {
    flat: 70,
    mountain: 70,
    hills: 70,
    cobbles: 70,
    downhill: 72,
    sprint: 70,
    acceleration: 72,
    timeTrial: 70,
    prologue: 69,
    endurance: 76,
    resistance: 75,
    recovery: 74,
    breakaway: 70,
    ...overrides,
  };
}

function opponent({
  id,
  name,
  teamId,
  teamName,
  primary,
  secondary,
  countryCode,
  role,
  ability,
  riderRatings,
}: {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  primary: string;
  secondary: string;
  countryCode: string;
  role: RiderSimulationInput["role"];
  ability: RiderSpecialAbility;
  riderRatings: RiderSimulationRatings;
}): RiderSimulationInput {
  return {
    id,
    name,
    teamId,
    teamName,
    teamPrimaryColor: primary,
    teamSecondaryColor: secondary,
    countryCode,
    age: 23 + (id.charCodeAt(id.length - 1) % 10),
    form: 74 + (id.charCodeAt(0) % 12),
    role,
    specialAbilities: [ability],
    ratings: riderRatings,
  };
}

const TUTORIAL_RACE_OPPONENTS: readonly RiderSimulationInput[] = [
  opponent({
    id: "tutorial-apex-1",
    name: "Milan Verbeek",
    teamId: "tutorial-apex",
    teamName: "Apex Vélo",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    countryCode: "BE",
    role: "leader",
    ability: "giclette",
    riderRatings: ratings({
      hills: 82,
      mountain: 79,
      acceleration: 80,
    }),
  }),
  opponent({
    id: "tutorial-apex-2",
    name: "Sven Martens",
    teamId: "tutorial-apex",
    teamName: "Apex Vélo",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    countryCode: "NL",
    role: "sprinter",
    ability: "flahute",
    riderRatings: ratings({
      flat: 82,
      sprint: 86,
      cobbles: 78,
    }),
  }),
  opponent({
    id: "tutorial-apex-3",
    name: "Elias Van Aert",
    teamId: "tutorial-apex",
    teamName: "Apex Vélo",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    countryCode: "BE",
    role: "leadout",
    ability: "locomotive",
    riderRatings: ratings({
      flat: 84,
      sprint: 77,
      endurance: 82,
    }),
  }),
  opponent({
    id: "tutorial-apex-4",
    name: "Niels De Smet",
    teamId: "tutorial-apex",
    teamName: "Apex Vélo",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    countryCode: "BE",
    role: "domestique",
    ability: "bottle_carrier",
    riderRatings: ratings({
      flat: 78,
      resistance: 81,
      recovery: 79,
    }),
  }),
  opponent({
    id: "tutorial-apex-5",
    name: "Timo Jansen",
    teamId: "tutorial-apex",
    teamName: "Apex Vélo",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    countryCode: "NL",
    role: "free_agent",
    ability: "panache",
    riderRatings: ratings({
      breakaway: 84,
      hills: 78,
      acceleration: 80,
    }),
  }),
  opponent({
    id: "tutorial-sierra-1",
    name: "Iker Salvatierra",
    teamId: "tutorial-sierra",
    teamName: "Sierra Roja",
    primary: "#C64B36",
    secondary: "#FFD15C",
    countryCode: "ES",
    role: "leader",
    ability: "giclette",
    riderRatings: ratings({
      mountain: 84,
      hills: 80,
      downhill: 79,
    }),
  }),
  opponent({
    id: "tutorial-sierra-2",
    name: "Mateo León",
    teamId: "tutorial-sierra",
    teamName: "Sierra Roja",
    primary: "#C64B36",
    secondary: "#FFD15C",
    countryCode: "ES",
    role: "mountain_classification",
    ability: "chase_potato",
    riderRatings: ratings({
      mountain: 82,
      breakaway: 83,
      endurance: 80,
    }),
  }),
  opponent({
    id: "tutorial-sierra-3",
    name: "Hugo Vidal",
    teamId: "tutorial-sierra",
    teamName: "Sierra Roja",
    primary: "#C64B36",
    secondary: "#FFD15C",
    countryCode: "ES",
    role: "sprinter",
    ability: "flahute",
    riderRatings: ratings({
      sprint: 83,
      flat: 79,
      acceleration: 82,
    }),
  }),
  opponent({
    id: "tutorial-sierra-4",
    name: "Álvaro Ríos",
    teamId: "tutorial-sierra",
    teamName: "Sierra Roja",
    primary: "#C64B36",
    secondary: "#FFD15C",
    countryCode: "ES",
    role: "domestique",
    ability: "bottle_carrier",
    riderRatings: ratings({
      endurance: 84,
      resistance: 81,
      mountain: 74,
    }),
  }),
  opponent({
    id: "tutorial-sierra-5",
    name: "Diego Mena",
    teamId: "tutorial-sierra",
    teamName: "Sierra Roja",
    primary: "#C64B36",
    secondary: "#FFD15C",
    countryCode: "ES",
    role: "free_agent",
    ability: "panache",
    riderRatings: ratings({
      cobbles: 77,
      hills: 78,
      breakaway: 81,
    }),
  }),
  opponent({
    id: "tutorial-flint-1",
    name: "Lars Holm",
    teamId: "tutorial-flint",
    teamName: "Flint Nordic",
    primary: "#6446A6",
    secondary: "#E8D9FF",
    countryCode: "DK",
    role: "leader",
    ability: "flahute",
    riderRatings: ratings({
      cobbles: 85,
      flat: 81,
      hills: 78,
    }),
  }),
  opponent({
    id: "tutorial-flint-2",
    name: "Mats Lindberg",
    teamId: "tutorial-flint",
    teamName: "Flint Nordic",
    primary: "#6446A6",
    secondary: "#E8D9FF",
    countryCode: "SE",
    role: "sprinter",
    ability: "locomotive",
    riderRatings: ratings({
      sprint: 84,
      flat: 82,
      acceleration: 81,
    }),
  }),
  opponent({
    id: "tutorial-flint-3",
    name: "Oskar Lund",
    teamId: "tutorial-flint",
    teamName: "Flint Nordic",
    primary: "#6446A6",
    secondary: "#E8D9FF",
    countryCode: "SE",
    role: "leadout",
    ability: "locomotive",
    riderRatings: ratings({
      flat: 83,
      endurance: 82,
      sprint: 75,
    }),
  }),
  opponent({
    id: "tutorial-flint-4",
    name: "Nils Berg",
    teamId: "tutorial-flint",
    teamName: "Flint Nordic",
    primary: "#6446A6",
    secondary: "#E8D9FF",
    countryCode: "NO",
    role: "domestique",
    ability: "bottle_carrier",
    riderRatings: ratings({
      recovery: 82,
      resistance: 80,
      cobbles: 76,
    }),
  }),
  opponent({
    id: "tutorial-flint-5",
    name: "Axel Nyström",
    teamId: "tutorial-flint",
    teamName: "Flint Nordic",
    primary: "#6446A6",
    secondary: "#E8D9FF",
    countryCode: "SE",
    role: "free_agent",
    ability: "panache",
    riderRatings: ratings({
      breakaway: 82,
      hills: 79,
      downhill: 78,
    }),
  }),
];
