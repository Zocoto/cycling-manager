import type {
  RaceProfileType,
  RaceStageType,
} from "./race-calendar";
import type { RaceWeather } from "./race-weather";

/**
 * The doctrine experiment is retired. Keeping its data contracts lets us read
 * historical simulations without letting a legacy briefing affect a new one.
 */
export const RACE_TACTICAL_DOCTRINES_ENABLED = false;

export const RACE_TACTICAL_DOCTRINE_CODES = [
  "breakaway_control",
  "crosswind_offensive",
  "satellite_rider",
  "sprint_train",
  "mountain_tempo",
] as const;

export type RaceTacticalDoctrineCode =
  (typeof RACE_TACTICAL_DOCTRINE_CODES)[number];

export type RaceTacticalAssignmentSlot = {
  key: string;
  label: string;
  hint: string;
};

export type RaceTacticalDoctrineDefinition = {
  code: RaceTacticalDoctrineCode;
  name: string;
  shortName: string;
  unlockLevel: number;
  trigger: string;
  benefit: string;
  cost: string;
  assignmentSlots: readonly RaceTacticalAssignmentSlot[];
  eligibleProfiles: readonly RaceProfileType[];
};

export const RACE_TACTICAL_DOCTRINES: Record<
  RaceTacticalDoctrineCode,
  RaceTacticalDoctrineDefinition
> = {
  breakaway_control: {
    code: "breakaway_control",
    name: "Contrôle de l’échappée",
    shortName: "Contrôle",
    unlockLevel: 1,
    trigger: "Une échappée adverse se forme et menace l’objectif de l’équipe.",
    benefit:
      "Le collectif rejoint les équipes qui contrôlent le peloton et augmente de 8 % sa pression de poursuite.",
    cost:
      "Les deux équipiers désignés dépensent chacun entre 5 et 8 % d’énergie avant le final.",
    assignmentSlots: [
      {
        key: "worker-1",
        label: "Premier rouleur",
        hint: "Assure les premiers relais de contrôle.",
      },
      {
        key: "worker-2",
        label: "Second rouleur",
        hint: "Prend le relais lorsque l’écart devient dangereux.",
      },
    ],
    eligibleProfiles: ["flat", "sprint", "hilly", "mountain", "cobbles", "mixed"],
  },
  crosswind_offensive: {
    code: "crosswind_offensive",
    name: "Bordure offensive",
    shortName: "Bordure",
    unlockLevel: 2,
    trigger:
      "Le parcours est plat et un vent latéral fort ou violent souffle sur l’étape.",
    benefit:
      "Le coureur protégé gagne en placement et l’aléa de son final est réduit de 10 %.",
    cost:
      "Le capitaine de route dépense 8 % d’énergie ; le leader reste exposé si son protecteur est distancé.",
    assignmentSlots: [
      {
        key: "protected",
        label: "Coureur protégé",
        hint: "Le coureur à placer devant au moment de la bordure.",
      },
      {
        key: "captain",
        label: "Capitaine de route",
        hint: "Déclenche et entretient la cassure.",
      },
    ],
    eligibleProfiles: ["flat", "sprint"],
  },
  satellite_rider: {
    code: "satellite_rider",
    name: "Coureur satellite",
    shortName: "Satellite",
    unlockLevel: 3,
    trigger:
      "Le satellite est encore devant à l’approche des 35 derniers kilomètres.",
    benefit:
      "Le leader économise 4 % d’énergie lorsqu’il attaque ou rejoint le groupe de tête.",
    cost:
      "Le satellite sacrifie son propre final et dépense 8 % d’énergie supplémentaire.",
    assignmentSlots: [
      {
        key: "leader",
        label: "Leader",
        hint: "Le coureur qui doit recevoir l’appui à distance.",
      },
      {
        key: "satellite",
        label: "Satellite",
        hint: "Doit partir à l’avant pour rendre le plan possible.",
      },
    ],
    eligibleProfiles: ["hilly", "mountain", "mixed"],
  },
  sprint_train: {
    code: "sprint_train",
    name: "Train de sprint",
    shortName: "Train",
    unlockLevel: 3,
    trigger: "Le groupe principal arrive ensemble dans le final.",
    benefit:
      "La variance de placement du sprinteur est réduite de 15 % et son lancement est mieux préparé.",
    cost:
      "Les trois lanceurs dépensent chacun 8 % d’énergie ; le coût reste entier si l’arrivée n’est pas massive.",
    assignmentSlots: [
      {
        key: "sprinter",
        label: "Sprinteur",
        hint: "Le coureur emmené jusqu’au lancement final.",
      },
      {
        key: "leadout-1",
        label: "Premier lanceur",
        hint: "Place le train dans les derniers kilomètres.",
      },
      {
        key: "leadout-2",
        label: "Deuxième lanceur",
        hint: "Maintient la vitesse du train.",
      },
      {
        key: "leadout-3",
        label: "Dernier lanceur",
        hint: "Dépose le sprinteur avant son effort.",
      },
    ],
    eligibleProfiles: ["flat", "sprint"],
  },
  mountain_tempo: {
    code: "mountain_tempo",
    name: "Tempo montagne",
    shortName: "Tempo",
    unlockLevel: 3,
    trigger: "Le peloton aborde une étape de montagne avec le leader encore placé.",
    benefit:
      "Le leader gagne en exécution et l’aléa de son final est réduit de 6 %.",
    cost:
      "Les deux grimpeurs de tempo dépensent chacun 6 % d’énergie et renoncent à leur liberté de mouvement.",
    assignmentSlots: [
      {
        key: "leader",
        label: "Leader protégé",
        hint: "Le coureur autour duquel le tempo est organisé.",
      },
      {
        key: "pacer-1",
        label: "Premier grimpeur",
        hint: "Impose le rythme au pied des ascensions.",
      },
      {
        key: "pacer-2",
        label: "Second grimpeur",
        hint: "Prolonge l’effort dans la partie décisive.",
      },
    ],
    eligibleProfiles: ["mountain"],
  },
};

export type RaceTacticalBriefing = {
  teamId: string;
  primaryDoctrine: RaceTacticalDoctrineCode;
  primaryRiderIds: string[];
  backupDoctrine: RaceTacticalDoctrineCode | null;
  backupRiderIds: string[];
  centerLevel: number;
};

export type RaceTacticalReport = {
  teamId: string;
  requestedDoctrine: RaceTacticalDoctrineCode;
  appliedDoctrine: RaceTacticalDoctrineCode | null;
  source: "primary" | "backup" | "none";
  triggered: boolean;
  summary: string;
  impacts: string[];
  energyCosts: Array<{ riderId: string; percentage: number }>;
};

export function isRaceTacticalDoctrineCode(
  value: unknown,
): value is RaceTacticalDoctrineCode {
  return RACE_TACTICAL_DOCTRINE_CODES.includes(
    value as RaceTacticalDoctrineCode,
  );
}

export function getRaceTacticalDoctrineDefinition(
  code: RaceTacticalDoctrineCode,
) {
  return RACE_TACTICAL_DOCTRINES[code];
}

export function getRaceTacticalDoctrineAssignmentCount(
  code: RaceTacticalDoctrineCode,
) {
  return RACE_TACTICAL_DOCTRINES[code].assignmentSlots.length;
}

export function isRaceTacticalDoctrineUnlocked(
  code: RaceTacticalDoctrineCode,
  centerLevel: number,
) {
  return centerLevel >= RACE_TACTICAL_DOCTRINES[code].unlockLevel;
}

export function isRaceTacticalDoctrineEligible({
  code,
  stageType,
  profileType,
  weather,
}: {
  code: RaceTacticalDoctrineCode;
  stageType: RaceStageType;
  profileType: RaceProfileType;
  weather?: RaceWeather;
}) {
  if (stageType !== "road") return false;
  if (!RACE_TACTICAL_DOCTRINES[code].eligibleProfiles.includes(profileType)) {
    return false;
  }
  if (code !== "crosswind_offensive") return true;

  return (
    weather?.windDirection === "crosswind" &&
    (weather.windIntensity === "strong" || weather.windIntensity === "gale")
  );
}

export function getRecommendedRaceTacticalDoctrineCodes({
  stageType,
  profileType,
  weather,
  centerLevel,
}: {
  stageType: RaceStageType;
  profileType: RaceProfileType;
  weather?: RaceWeather;
  centerLevel: number;
}) {
  if (centerLevel < 2) return [];

  return RACE_TACTICAL_DOCTRINE_CODES.filter(
    (code) =>
      isRaceTacticalDoctrineUnlocked(code, centerLevel) &&
      isRaceTacticalDoctrineEligible({
        code,
        stageType,
        profileType,
        weather,
      }),
  ).sort((left, right) => {
    const priority = (code: RaceTacticalDoctrineCode) => {
      if (code === "crosswind_offensive") return 0;
      if (profileType === "mountain" && code === "mountain_tempo") return 1;
      if (
        (profileType === "flat" || profileType === "sprint") &&
        code === "sprint_train"
      ) {
        return 1;
      }
      if (
        (profileType === "hilly" || profileType === "mixed") &&
        code === "satellite_rider"
      ) {
        return 1;
      }
      return code === "breakaway_control" ? 2 : 3;
    };

    return priority(left) - priority(right) || left.localeCompare(right);
  });
}

export function validateRaceTacticalAssignments(
  code: RaceTacticalDoctrineCode,
  riderIds: readonly string[],
) {
  return (
    riderIds.length === getRaceTacticalDoctrineAssignmentCount(code) &&
    new Set(riderIds).size === riderIds.length &&
    riderIds.every(Boolean)
  );
}
