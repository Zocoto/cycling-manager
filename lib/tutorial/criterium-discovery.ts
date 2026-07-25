import {
  type RaceCalendarEdition,
  type RaceCalendarStage,
} from "@/lib/game/race-calendar";
import {
  OFFICIAL_RACE_ENGINE_VERSION,
  simulateOfficialRaceEdition,
  type LockedOfficialStageSimulation,
} from "@/lib/game/official-race-simulation";
import { buildRaceSegments } from "@/lib/game/race-profiles";
import {
  createDemoSimulationInput,
} from "@/lib/game/race-simulation-demo";
import {
  RACE_ROLES,
  type RaceRole,
  type RiderSimulationInput,
} from "@/lib/game/race-simulation";

export const CRITERIUM_DISCOVERY_KEY =
  "criterium-discovery";
export const CRITERIUM_DISCOVERY_SLUG =
  "criterium-de-la-decouverte";
export const CRITERIUM_DISCOVERY_NAME =
  "Critérium de la découverte";
export const CRITERIUM_DISCOVERY_VERSION = 1;
export const CRITERIUM_DISCOVERY_ROSTER_SIZE = 5;

export const CRITERIUM_DISCOVERY_RACE_ROUTE =
  `/jeu/courses/${CRITERIUM_DISCOVERY_SLUG}`;
export const CRITERIUM_DISCOVERY_RESULTS_ROUTE =
  `/jeu/resultats/${CRITERIUM_DISCOVERY_SLUG}/1`;

const CRITERIUM_RACE_ID =
  "d15c0a01-6f04-4fc7-9a01-201c04c7d001";
const CRITERIUM_EDITION_ID =
  "d15c0a02-6f04-4fc7-9a02-201c04c7d002";
const CRITERIUM_STAGE_ID =
  "d15c0a03-6f04-4fc7-9a03-201c04c7d003";

export type CriteriumDiscoveryRosterEntry = {
  riderId: string;
  role: RaceRole;
};

export type CriteriumDiscoveryRun = {
  version: number;
  registeredAt: string;
  completedAt: string | null;
  roster: CriteriumDiscoveryRosterEntry[];
  edition: RaceCalendarEdition;
  lockedSimulation: LockedOfficialStageSimulation;
};

type CreateCriteriumDiscoveryEditionOptions = {
  dayNumber: number;
  rosterCount?: number;
  engagedRiders?: RiderSimulationInput[];
  completed?: boolean;
};

type CreateCriteriumDiscoveryRunOptions = {
  dayNumber: number;
  roster: CriteriumDiscoveryRosterEntry[];
  playerRiders: RiderSimulationInput[];
  registeredAt: string;
};

export function createCriteriumDiscoveryPreviewEdition({
  dayNumber,
  rosterCount = 0,
  engagedRiders = [],
  completed = false,
}: CreateCriteriumDiscoveryEditionOptions): RaceCalendarEdition {
  const safeDayNumber = Math.min(
    28,
    Math.max(1, Math.trunc(dayNumber)),
  );

  const stage: RaceCalendarStage = {
    id: CRITERIUM_STAGE_ID,
    dayNumber: safeDayNumber,
    stageNumber: 1,
    name: CRITERIUM_DISCOVERY_NAME,
    stageType: "road",
    status: completed ? "completed" : "planned",
    profileType: "mixed",
    distanceKm: 120,
    daySlot: "early",
    departureAt: null,
    segments: buildRaceSegments({
      distanceKm: 120,
      profileType: "mixed",
      seed: `${CRITERIUM_DISCOVERY_KEY}:profile:v${CRITERIUM_DISCOVERY_VERSION}`,
      includeTourPrimes: false,
    }),
  };

  return {
    id: CRITERIUM_EDITION_ID,
    status: completed
      ? "completed"
      : rosterCount > 0
        ? "registration_closed"
        : "registration_open",
    raceId: CRITERIUM_RACE_ID,
    slug: CRITERIUM_DISCOVERY_SLUG,
    name: CRITERIUM_DISCOVERY_NAME,
    shortName: "Critérium découverte",
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "Initiation",
    prestigeRank: 99,
    raceFormat: "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: 0,
    minimumRosterSize: CRITERIUM_DISCOVERY_ROSTER_SIZE,
    maximumRosterSize: CRITERIUM_DISCOVERY_ROSTER_SIZE,
    engagedRiderCount: engagedRiders.length,
    engagedRiders: engagedRiders.map(cloneRider),
    currentTeamRegistration:
      rosterCount > 0
        ? {
            status: "accepted",
            rosterCount,
          }
        : null,
    stages: [stage],
  };
}

export function createCriteriumDiscoveryRun({
  dayNumber,
  roster,
  playerRiders,
  registeredAt,
}: CreateCriteriumDiscoveryRunOptions): CriteriumDiscoveryRun {
  if (!isValidCriteriumDiscoveryRoster(roster)) {
    throw new Error(
      `Le ${CRITERIUM_DISCOVERY_NAME} exige exactement ${CRITERIUM_DISCOVERY_ROSTER_SIZE} coureurs différents.`,
    );
  }

  if (
    playerRiders.length !==
    CRITERIUM_DISCOVERY_ROSTER_SIZE
  ) {
    throw new Error(
      "La startlist du joueur ne correspond pas à la sélection enregistrée.",
    );
  }

  const opponents = createDemoSimulationInput(
    "collines-ardennes",
    `${CRITERIUM_DISCOVERY_KEY}:opponents:v${CRITERIUM_DISCOVERY_VERSION}`,
  ).riders.map(cloneRider);

  const edition =
    createCriteriumDiscoveryPreviewEdition({
      dayNumber,
      rosterCount: roster.length,
      engagedRiders: [
        ...playerRiders.map(cloneRider),
        ...opponents,
      ],
      completed: true,
    });

  const stage = edition.stages[0];

  if (!stage) {
    throw new Error(
      "Le profil du Critérium de la découverte est indisponible.",
    );
  }

  const officialRun =
    simulateOfficialRaceEdition(edition)[0];

  if (!officialRun) {
    throw new Error(
      "Le moteur officiel n’a pas produit la simulation attendue.",
    );
  }

  return {
    version: CRITERIUM_DISCOVERY_VERSION,
    registeredAt,
    completedAt: null,
    roster: roster.map((entry) => ({ ...entry })),
    edition,
    lockedSimulation: {
      stageId: stage.id,
      raceEditionId: edition.id,
      engineVersion:
        OFFICIAL_RACE_ENGINE_VERSION,
      seed: officialRun.simulation.seed,
      input: officialRun.input,
      simulation: officialRun.simulation,
    },
  };
}

export function isValidCriteriumDiscoveryRoster(
  roster: readonly CriteriumDiscoveryRosterEntry[],
): boolean {
  if (
    roster.length !==
    CRITERIUM_DISCOVERY_ROSTER_SIZE
  ) {
    return false;
  }

  if (
    new Set(
      roster.map((entry) => entry.riderId),
    ).size !==
    CRITERIUM_DISCOVERY_ROSTER_SIZE
  ) {
    return false;
  }

  return ["leader", "sprinter"].every(
    (role) =>
      roster.filter(
        (entry) => entry.role === role,
      ).length <= 1,
  );
}

export function getCriteriumDiscoveryRunFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): CriteriumDiscoveryRun | null {
  const candidate =
    metadata?.criteriumDiscoveryRun;

  if (!isRecord(candidate)) {
    return null;
  }

  if (
    candidate.version !==
      CRITERIUM_DISCOVERY_VERSION ||
    typeof candidate.registeredAt !==
      "string" ||
    !Array.isArray(candidate.roster) ||
    !isRecord(candidate.edition) ||
    candidate.edition.slug !==
      CRITERIUM_DISCOVERY_SLUG ||
    !isRecord(
      candidate.lockedSimulation,
    )
  ) {
    return null;
  }

  const roster =
    candidate.roster.filter(
      (
        entry,
      ): entry is CriteriumDiscoveryRosterEntry =>
        isRecord(entry) &&
        typeof entry.riderId === "string" &&
        typeof entry.role === "string" &&
        RACE_ROLES.includes(
          entry.role as RaceRole,
        ),
    );

  if (
    !isValidCriteriumDiscoveryRoster(
      roster,
    )
  ) {
    return null;
  }

  const locked =
    candidate.lockedSimulation;

  if (
    locked.stageId !==
      CRITERIUM_STAGE_ID ||
    locked.raceEditionId !==
      CRITERIUM_EDITION_ID ||
    !isRecord(locked.input) ||
    !isRecord(locked.simulation)
  ) {
    return null;
  }

  return candidate as CriteriumDiscoveryRun;
}

export function appendCriteriumDiscoveryEdition({
  editions,
  edition,
}: {
  editions: RaceCalendarEdition[];
  edition: RaceCalendarEdition;
}): RaceCalendarEdition[] {
  return [
    edition,
    ...editions.filter(
      (candidate) =>
        candidate.slug !==
        CRITERIUM_DISCOVERY_SLUG,
    ),
  ];
}

function cloneRider(
  rider: RiderSimulationInput,
): RiderSimulationInput {
  return {
    ...rider,
    ratings: { ...rider.ratings },
    specialAbilities: rider.specialAbilities
      ? [...rider.specialAbilities]
      : undefined,
    equipmentEffects:
      rider.equipmentEffects
        ? { ...rider.equipmentEffects }
        : undefined,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
