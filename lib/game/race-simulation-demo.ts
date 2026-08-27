import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  RaceProfileType,
} from "./race-calendar";
import {
  buildRaceSegments,
  removeOneDayRaceMountainPrimes,
} from "./race-profiles";
import { getRaceWeather } from "./race-weather";
import {
  type RiderSimulationInput,
  type RiderSimulationRatings,
  type RaceRole,
  type SimulationStageType,
  type StageSimulationInput,
} from "./race-simulation";
import { resolveStageRaceRole } from "./stage-race-roles";
import {
  getRiderRaceDuty,
  MAX_RACE_ATTACK_ORDERS,
  type RaceAttackOrder,
  type RaceTeamStrategy,
} from "./race-strategy";

export const RACE_DEMO_SCENARIOS = [
  {
    id: "sprint-littoral",
    label: "Classique pour sprinteurs",
    name: "Grand Prix du Littoral — prototype",
    profileType: "sprint",
    stageType: "road",
    distanceKm: 154,
    isStageRace: false,
  },
  {
    id: "collines-ardennes",
    label: "Étape vallonnée",
    name: "Boucle des Collines — étape 3",
    profileType: "hilly",
    stageType: "road",
    distanceKm: 171,
    isStageRace: true,
  },
  {
    id: "haute-montagne",
    label: "Étape de montagne",
    name: "Cime du Tyrol — étape reine",
    profileType: "mountain",
    stageType: "road",
    distanceKm: 177,
    isStageRace: true,
  },
  {
    id: "paves-zelande",
    label: "Classique pavée",
    name: "Les Pavés de Zélande — prototype",
    profileType: "cobbles",
    stageType: "road",
    distanceKm: 166,
    isStageRace: false,
  },
  {
    id: "chrono-algarve",
    label: "Contre-la-montre",
    name: "Chrono de l’Algarve — prototype",
    profileType: "time_trial",
    stageType: "individual_time_trial",
    distanceKm: 39,
    isStageRace: false,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  name: string;
  profileType: RaceProfileType;
  stageType: SimulationStageType;
  distanceKm: number;
  isStageRace: boolean;
}>;

export type RaceDemoScenarioId = (typeof RACE_DEMO_SCENARIOS)[number]["id"];

export function createDemoSimulationInput(
  scenarioId: RaceDemoScenarioId,
  seed: string | number,
): StageSimulationInput {
  const scenario =
    RACE_DEMO_SCENARIOS.find((candidate) => candidate.id === scenarioId) ??
    RACE_DEMO_SCENARIOS[0];

  return {
    id: scenario.id,
    name: scenario.name,
    stageType: scenario.stageType,
    profileType: scenario.profileType,
    isStageRace: scenario.isStageRace,
    seed,
    weather: getRaceWeather(`${scenario.id}:${seed}:weather`, {
      profileType: scenario.profileType,
    }),
    segments: buildRaceSegments({
      distanceKm: scenario.distanceKm,
      profileType: scenario.profileType,
      seed: `${scenario.id}:profile`,
      includeTourPrimes: scenario.isStageRace,
    }),
    riders: DEMO_RIDERS,
  };
}

export function createCalendarSimulationInput({
  edition,
  stage,
  seed,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  seed: string | number;
}): StageSimulationInput {
  const teamStrategies = Object.values(stage.teamStrategies ?? {}).sort(
    (first, second) => first.teamId.localeCompare(second.teamId),
  );
  const rawSourceRiders =
    edition.engagedRiders.length > 0
      ? edition.engagedRiders
      : edition.slug === "criterium-de-namur"
        ? DEMO_RIDERS
        : [];

  if (rawSourceRiders.length === 0) {
    throw new Error(
      `La course ${edition.name} ne peut pas être simulée sans startlist enregistrée.`,
    );
  }
  // Une même personne peut temporairement subsister dans deux inscriptions
  // après une signature ou une vente (équipe puis « Coureurs libres »). La
  // course reste unique : le moteur ne doit jamais recevoir deux fois le même
  // coureur, même si la synchronisation de la base est encore en cours.
  const sourceRiders = [
    ...new Map(rawSourceRiders.map((rider) => [rider.id, rider])).values(),
  ];
  const sanitizedTeamStrategies = sanitizeCalendarTeamStrategies({
    stage,
    sourceRiders,
  });
  teamStrategies.splice(
    0,
    teamStrategies.length,
    ...sanitizedTeamStrategies,
  );

  const riders = sanitizeUniqueCalendarRaceRoles(
    sourceRiders
    .map((rider) => {
      const { equipmentEffectsByStageId, ...baseRider } = rider;
      const teamStrategy = stage.teamStrategies?.[rider.teamId];
      const raceDuty = getRiderRaceDuty(teamStrategy, rider.id);
      const specialAbilities = [
        ...(rider.specialAbilities ?? []),
        ...(rider.specialAbility ? [rider.specialAbility] : []),
      ]
        .filter(
          (ability, index, abilities) => abilities.indexOf(ability) === index,
        )
        .sort();

      return {
        ...baseRider,
        role: resolveStageRaceRole({
          riderId: rider.id,
          generalRole: rider.role,
          roleOverrides: stage.riderRoleOverrides,
        }),
        ...(raceDuty ? { raceDuty } : {}),
        specialAbility: specialAbilities[0] ?? null,
        ...(specialAbilities.length > 0 || rider.specialAbilities !== undefined
          ? { specialAbilities }
          : {}),
        ratings: { ...rider.ratings },
        ...(equipmentEffectsByStageId?.[stage.id]
          ? { equipmentEffects: equipmentEffectsByStageId[stage.id] }
          : {}),
      };
    })
    .sort(
      (first, second) =>
        first.teamId.localeCompare(second.teamId) ||
        first.id.localeCompare(second.id),
    ),
    stage,
  );
  const riderIds = new Set(riders.map((rider) => rider.id));
  const timeTrialPlans = Object.fromEntries(
    Object.entries(stage.timeTrialPlans ?? {}).filter(([riderId]) =>
      riderIds.has(riderId),
    ),
  );

  const segments = removeOneDayRaceMountainPrimes(
    stage.segments.length > 0
      ? [...stage.segments].sort(
          (first, second) => first.segmentNumber - second.segmentNumber,
        )
      : buildRaceSegments({
          distanceKm: stage.distanceKm,
          profileType: stage.profileType,
          seed: `${stage.id}:fallback-profile`,
          includeTourPrimes: edition.raceFormat === "stage_race",
        }),
    edition.raceFormat,
  );

  return {
    id: stage.id,
    name:
      edition.raceFormat === "stage_race"
        ? `${edition.name} — étape ${stage.stageNumber}`
        : edition.name,
    stageType: stage.stageType,
    profileType: stage.profileType,
    raceCountryCode: edition.countryCode,
    gameDayIndex: stage.gameDayIndex,
    isStageRace: edition.raceFormat === "stage_race",
    stageNumber: stage.stageNumber,
    stageCount: edition.stages.length,
    seed,
    weather: getRaceWeather(`${edition.id}:${stage.id}:weather`, {
      countryCode: edition.countryCode,
      profileType: stage.profileType,
    }),
    segments,
    riders: riders.map((rider) => {
      const reconnaissanceBonus = stage.reconnaissanceBonuses?.[rider.id] ?? 0;
      return reconnaissanceBonus > 0
        ? { ...rider, reconnaissanceBonus }
        : rider;
    }),
    ...(Object.keys(timeTrialPlans).length > 0 ? { timeTrialPlans } : {}),
    ...(teamStrategies.length > 0 ? { teamStrategies } : {}),
  };
}

/**
 * Les anciennes startlists peuvent contenir plusieurs leaders ou sprinteurs
 * dans une même équipe. Le formulaire empêche désormais ce cas, mais une
 * simulation officielle doit rester capable de relire cet historique. On
 * privilégie une consigne propre à l'étape, puis le coureur le plus adapté au
 * rôle ; les doublons sont remis en mode automatique uniquement dans l'entrée
 * du moteur, sans réécrire les choix du directeur sportif.
 */
export function sanitizeUniqueCalendarRaceRoles(
  riders: readonly RiderSimulationInput[],
  stage: RaceCalendarStage,
): RiderSimulationInput[] {
  const sanitizedRiders = riders.map((rider) => ({ ...rider }));
  const ridersByTeam = new Map<string, RiderSimulationInput[]>();

  for (const rider of sanitizedRiders) {
    const teamRiders = ridersByTeam.get(rider.teamId) ?? [];
    teamRiders.push(rider);
    ridersByTeam.set(rider.teamId, teamRiders);
  }

  for (const teamRiders of ridersByTeam.values()) {
    for (const uniqueRole of ["leader", "sprinter"] satisfies RaceRole[]) {
      const candidates = teamRiders.filter(
        (rider) => rider.role === uniqueRole,
      );
      if (candidates.length <= 1) continue;

      const retainedRider = [...candidates].sort((first, second) => {
        const firstHasStageOverride =
          stage.riderRoleOverrides?.[first.id] === uniqueRole;
        const secondHasStageOverride =
          stage.riderRoleOverrides?.[second.id] === uniqueRole;
        return (
          Number(secondHasStageOverride) - Number(firstHasStageOverride) ||
          getUniqueRoleSuitability(second, uniqueRole, stage) -
            getUniqueRoleSuitability(first, uniqueRole, stage) ||
          first.id.localeCompare(second.id)
        );
      })[0];

      for (const rider of candidates) {
        if (rider.id !== retainedRider.id) rider.role = "auto";
      }
    }
  }

  return sanitizedRiders;
}

function getUniqueRoleSuitability(
  rider: RiderSimulationInput,
  role: "leader" | "sprinter",
  stage: RaceCalendarStage,
) {
  if (role === "sprinter") {
    return (
      rider.ratings.sprint * 2 +
      rider.ratings.acceleration +
      rider.ratings.flat
    );
  }

  const profileRating =
    stage.stageType === "individual_time_trial"
      ? rider.ratings.timeTrial
      : stage.stageType === "prologue"
        ? rider.ratings.prologue
        : stage.profileType === "mountain"
          ? rider.ratings.mountain
          : stage.profileType === "hilly"
            ? rider.ratings.hills
            : stage.profileType === "cobbles"
              ? rider.ratings.cobbles
              : rider.ratings.flat;

  return (
    profileRating * 2 +
    rider.ratings.endurance +
    rider.ratings.resistance +
    rider.ratings.recovery +
    rider.ratings.timeTrial
  );
}

export function sanitizeCalendarTeamStrategies({
  stage,
  sourceRiders,
}: {
  stage: RaceCalendarStage;
  sourceRiders: readonly RiderSimulationInput[];
}): RaceTeamStrategy[] {
  const riderTeamById = new Map(
    sourceRiders.map((rider) => [rider.id, rider.teamId]),
  );
  const engagedTeamIds = new Set(sourceRiders.map((rider) => rider.teamId));
  const segmentNumbers = new Set(
    stage.segments.map((segment) => segment.segmentNumber),
  );
  const sanitizeDutyRiderId = (riderId: string | null, teamId: string) =>
    riderId && riderTeamById.get(riderId) === teamId ? riderId : null;
  const isValidAttackOrder = (
    order: RaceAttackOrder,
    teamId: string,
  ) =>
    riderTeamById.get(order.riderId) === teamId &&
    segmentNumbers.has(order.segmentNumber);

  return Object.values(stage.teamStrategies ?? {})
    .filter((strategy) => engagedTeamIds.has(strategy.teamId))
    .map((strategy) => {
      const sanitized: RaceTeamStrategy = {
        ...strategy,
        lieutenantRiderId: sanitizeDutyRiderId(
          strategy.lieutenantRiderId,
          strategy.teamId,
        ),
        dangerPacerRiderId: sanitizeDutyRiderId(
          strategy.dangerPacerRiderId,
          strategy.teamId,
        ),
        protectorRiderId: sanitizeDutyRiderId(
          strategy.protectorRiderId,
          strategy.teamId,
        ),
        breakawayRiderId: sanitizeDutyRiderId(
          strategy.breakawayRiderId,
          strategy.teamId,
        ),
        attackOrders: strategy.attackOrders
          .filter((order) => isValidAttackOrder(order, strategy.teamId))
          .slice(0, MAX_RACE_ATTACK_ORDERS),
      };

      return removeDuplicateTacticalDuties(sanitized);
    })
    .sort((first, second) => first.teamId.localeCompare(second.teamId));
}

function removeDuplicateTacticalDuties(
  strategy: RaceTeamStrategy,
): RaceTeamStrategy {
  const assignedRiderIds = new Set<string>();
  const keepOnce = (riderId: string | null) => {
    if (!riderId || assignedRiderIds.has(riderId)) return null;
    assignedRiderIds.add(riderId);
    return riderId;
  };

  return {
    ...strategy,
    lieutenantRiderId: keepOnce(strategy.lieutenantRiderId),
    dangerPacerRiderId: keepOnce(strategy.dangerPacerRiderId),
    protectorRiderId: keepOnce(strategy.protectorRiderId),
    breakawayRiderId: keepOnce(strategy.breakawayRiderId),
  };
}

const TEAMS = [
  {
    id: "veloria",
    name: "Veloria Mobilités",
    primary: "#1E9E78",
    secondary: "#F2C94C",
    names: [
      "Luc Moreau",
      "Émile Laurent",
      "Noé Garnier",
      "Bastien Roy",
      "Sacha Perrin",
      "Léo Chevalier",
    ],
  },
  {
    id: "nordika",
    name: "Nordika Glass",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    names: [
      "Mats Lindberg",
      "Jonas Dahl",
      "Erik Nyström",
      "Oskar Lund",
      "Nils Berg",
      "Axel Holm",
    ],
  },
  {
    id: "sol-del-sur",
    name: "Sol del Sur",
    primary: "#D85635",
    secondary: "#FFD15C",
    names: [
      "Iker Lozano",
      "Mateo Ruiz",
      "Hugo Vidal",
      "Álvaro León",
      "Diego Mena",
      "Sergio Rey",
    ],
  },
  {
    id: "lumen",
    name: "Lumen Energy",
    primary: "#7C4DCE",
    secondary: "#E8D9FF",
    names: [
      "Marco Belli",
      "Luca Serra",
      "Enzo Riva",
      "Paolo Conti",
      "Dario Greco",
      "Nico Sala",
    ],
  },
] as const;

const ARCHETYPES = [
  {
    role: "leader",
    ability: "giclette",
    ratings: rating({
      mountain: 83,
      hills: 81,
      acceleration: 79,
      recovery: 82,
      sprint: 67,
    }),
  },
  {
    role: "sprinter",
    ability: "flahute",
    ratings: rating({
      flat: 80,
      sprint: 87,
      acceleration: 84,
      resistance: 80,
      mountain: 58,
    }),
  },
  {
    role: "leadout",
    ability: "locomotive",
    ratings: rating({
      flat: 84,
      sprint: 76,
      acceleration: 78,
      endurance: 83,
      timeTrial: 79,
    }),
  },
  {
    role: "free_agent",
    ability: "panache",
    ratings: rating({
      hills: 79,
      breakaway: 86,
      acceleration: 81,
      endurance: 80,
      sprint: 72,
    }),
  },
  {
    role: "domestique",
    ability: "bottle_carrier",
    ratings: rating({
      flat: 78,
      mountain: 75,
      endurance: 85,
      resistance: 79,
      recovery: 81,
    }),
  },
  {
    role: "mountain_classification",
    ability: "chase_potato",
    ratings: rating({
      mountain: 85,
      hills: 78,
      breakaway: 82,
      acceleration: 76,
      recovery: 80,
      sprint: 60,
    }),
  },
] as const;

const DEMO_RIDERS: RiderSimulationInput[] = TEAMS.flatMap((team, teamIndex) =>
  ARCHETYPES.map((archetype, riderIndex) => {
    const ratingShift = teamIndex * 0.7 - riderIndex * 0.35;
    return {
      id: `${team.id}-${riderIndex + 1}`,
      name: team.names[riderIndex],
      teamId: team.id,
      teamName: team.name,
      teamPrimaryColor: team.primary,
      teamSecondaryColor: team.secondary,
      age: 22 + ((teamIndex * 3 + riderIndex * 2) % 13),
      form: 72 + ((teamIndex * 7 + riderIndex * 5) % 19),
      role: archetype.role,
      specialAbility: archetype.ability,
      ratings: Object.fromEntries(
        Object.entries(archetype.ratings).map(([key, value]) => [
          key,
          Math.round(Math.min(92, Math.max(50, value + ratingShift))),
        ]),
      ) as RiderSimulationRatings,
    } satisfies RiderSimulationInput;
  }),
);

function rating(
  overrides: Partial<RiderSimulationRatings>,
): RiderSimulationRatings {
  return {
    flat: 70,
    mountain: 70,
    hills: 70,
    cobbles: 69,
    downhill: 72,
    sprint: 70,
    acceleration: 72,
    timeTrial: 71,
    prologue: 70,
    endurance: 76,
    resistance: 75,
    recovery: 74,
    breakaway: 70,
    ...overrides,
  };
}
