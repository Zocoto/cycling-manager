import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  RaceProfileType,
} from "./race-calendar";
import { buildRaceSegments } from "./race-profiles";
import { getRaceWeather } from "./race-weather";
import {
  type RiderSimulationInput,
  type RiderSimulationRatings,
  type SimulationStageType,
  type StageSimulationInput,
} from "./race-simulation";

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

export type RaceDemoScenarioId =
  (typeof RACE_DEMO_SCENARIOS)[number]["id"];

export function createDemoSimulationInput(
  scenarioId: RaceDemoScenarioId,
  seed: string | number
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
    weather: getRaceWeather(`${scenario.id}:${seed}:weather`),
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
  const riders =
    edition.engagedRiders.length > 0
      ? edition.engagedRiders
      : edition.slug === "criterium-de-namur"
        ? DEMO_RIDERS
        : [];

  if (riders.length === 0) {
    throw new Error(
      `La course ${edition.name} ne peut pas être simulée sans startlist enregistrée.`
    );
  }

  return {
    id: stage.id,
    name:
      edition.raceFormat === "stage_race"
        ? `${edition.name} — étape ${stage.stageNumber}`
        : edition.name,
    stageType: stage.stageType,
    profileType: stage.profileType,
    raceCountryCode: edition.countryCode,
    isStageRace: edition.raceFormat === "stage_race",
    seed,
    weather: getRaceWeather(`${edition.id}:${stage.id}:weather`),
    segments:
      stage.segments.length > 0
        ? stage.segments
        : buildRaceSegments({
            distanceKm: stage.distanceKm,
            profileType: stage.profileType,
            seed: `${stage.id}:fallback-profile`,
            includeTourPrimes: edition.raceFormat === "stage_race",
          }),
    riders: riders.map((rider) => {
      const reconnaissanceBonus =
        stage.reconnaissanceBonuses?.[rider.id] ?? 0;
      return reconnaissanceBonus > 0
        ? { ...rider, reconnaissanceBonus }
        : rider;
    }),
  };
}

const TEAMS = [
  {
    id: "veloria",
    name: "Veloria Mobilités",
    primary: "#1E9E78",
    secondary: "#F2C94C",
    names: ["Luc Moreau", "Émile Laurent", "Noé Garnier", "Bastien Roy", "Sacha Perrin", "Léo Chevalier"],
  },
  {
    id: "nordika",
    name: "Nordika Glass",
    primary: "#2457C5",
    secondary: "#E7F2FF",
    names: ["Mats Lindberg", "Jonas Dahl", "Erik Nyström", "Oskar Lund", "Nils Berg", "Axel Holm"],
  },
  {
    id: "sol-del-sur",
    name: "Sol del Sur",
    primary: "#D85635",
    secondary: "#FFD15C",
    names: ["Iker Lozano", "Mateo Ruiz", "Hugo Vidal", "Álvaro León", "Diego Mena", "Sergio Rey"],
  },
  {
    id: "lumen",
    name: "Lumen Energy",
    primary: "#7C4DCE",
    secondary: "#E8D9FF",
    names: ["Marco Belli", "Luca Serra", "Enzo Riva", "Paolo Conti", "Dario Greco", "Nico Sala"],
  },
] as const;

const ARCHETYPES = [
  {
    role: "leader",
    ability: "giclette",
    ratings: rating({ mountain: 83, hills: 81, acceleration: 79, recovery: 82, sprint: 67 }),
  },
  {
    role: "sprinter",
    ability: "flahute",
    ratings: rating({ flat: 80, sprint: 87, acceleration: 84, resistance: 80, mountain: 58 }),
  },
  {
    role: "leadout",
    ability: "locomotive",
    ratings: rating({ flat: 84, sprint: 76, acceleration: 78, endurance: 83, timeTrial: 79 }),
  },
  {
    role: "free_agent",
    ability: "panache",
    ratings: rating({ hills: 79, breakaway: 86, acceleration: 81, endurance: 80, sprint: 72 }),
  },
  {
    role: "domestique",
    ability: "bottle_carrier",
    ratings: rating({ flat: 78, mountain: 75, endurance: 85, resistance: 79, recovery: 81 }),
  },
  {
    role: "mountain_classification",
    ability: "chase_potato",
    ratings: rating({ mountain: 85, hills: 78, breakaway: 82, acceleration: 76, recovery: 80, sprint: 60 }),
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
        ])
      ) as RiderSimulationRatings,
    } satisfies RiderSimulationInput;
  })
);

function rating(
  overrides: Partial<RiderSimulationRatings>
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
