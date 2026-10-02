import type { RaceStageSegment } from "@/lib/game/race-profiles";

export const PCM_GALA_ROSTER_SIZE = 7;

export type PcmGalaRaceKey =
  | "gala-des-sommets"
  | "gala-des-puncheurs"
  | "gala-des-sprinteurs";

export type PcmGalaRatingKey = "mountain" | "hills" | "sprint";

export type PcmGalaRace = {
  key: PcmGalaRaceKey;
  name: string;
  shortDescription: string;
  profileLabel: string;
  distanceKm: number;
  accentColor: string;
  primaryRating: PcmGalaRatingKey;
  pcmSource: {
    raceName: string;
    raceId: number;
    stageId: number;
    stageFilename: string;
    raceType: "CLAS_MO" | "CLAS_VAL" | "CLAS_PLONLY";
  };
  segments: RaceStageSegment[];
};

function segments(
  profile: ReadonlyArray<readonly [distanceKm: number, gradient: number]>,
): RaceStageSegment[] {
  return profile.map(([distanceKm, averageGradientPct], index) => ({
    segmentNumber: index + 1,
    distanceKm,
    terrain:
      averageGradientPct > 0
        ? "climb"
        : averageGradientPct < 0
          ? "descent"
          : "flat",
    averageGradientPct,
    surface: "asphalt",
    prime: null,
  }));
}

/**
 * Les identifiants et typologies viennent de la base officielle PCM26.
 * Les profils sont volontairement retranscrits dans le format de segments CS :
 * ils servent à présenter le caractère de l'épreuve, pas à simuler la course.
 */
export const PCM_GALA_RACES: readonly PcmGalaRace[] = [
  {
    key: "gala-des-sommets",
    name: "Gala des Sommets",
    shortDescription:
      "Une classique de montagne exigeante, avec plusieurs longues ascensions et un final encore sélectif.",
    profileLabel: "Montagne",
    distanceKm: 241,
    accentColor: "#B4553B",
    primaryRating: "mountain",
    pcmSource: {
      raceName: "Il Lombardia",
      raceId: 172,
      stageId: 1172,
      stageFilename: "topclas_lombardia",
      raceType: "CLAS_MO",
    },
    segments: segments([
      [25, 0], [14, 3.5], [12, -4], [30, 0], [12, 4.5], [10, -4.8],
      [45, 0], [18, 5.5], [14, -5.2], [10, 0], [12, 6.2], [9, -5.5],
      [10, 0], [8, 6.8], [9, -5.8], [3, 0],
    ]),
  },
  {
    key: "gala-des-puncheurs",
    name: "Gala des Puncheurs",
    shortDescription:
      "Un enchaînement de côtes courtes où le placement et l'explosivité feront la différence jusqu'à l'arrivée.",
    profileLabel: "Vallons",
    distanceKm: 205,
    accentColor: "#8B6A2B",
    primaryRating: "hills",
    pcmSource: {
      raceName: "La Flèche Wallonne",
      raceId: 15,
      stageId: 1015,
      stageFilename: "topclas_fleche",
      raceType: "CLAS_VAL",
    },
    segments: segments([
      [37, 0], [10, 4.2], [8, -4.6], [20, 0], [7, 5.1], [6, -5],
      [22, 0], [8, 5.8], [7, -5.4], [20, 0], [6, 6.1], [5, -5.7],
      [18, 0], [8, 6.4], [6, -5.8], [12, 0], [5, 9],
    ]),
  },
  {
    key: "gala-des-sprinteurs",
    name: "Gala des Sprinteurs",
    shortDescription:
      "Une grande classique roulante, légèrement nerveuse dans le final, promise aux hommes rapides encore bien placés.",
    profileLabel: "Sprint",
    distanceKm: 213,
    accentColor: "#267A68",
    primaryRating: "sprint",
    pcmSource: {
      raceName: "Paris–Tours",
      raceId: 92,
      stageId: 1092,
      stageFilename: "c0_paristours",
      raceType: "CLAS_PLONLY",
    },
    segments: segments([
      [40, 0], [35, 0], [30, 0], [25, 0], [20, 0], [8, 2.8],
      [7, -3.2], [12, 0], [5, 3.2], [4, -3.5], [12, 0], [15, 0],
    ]),
  },
] as const;

export function isPcmGalaRaceKey(value: string): value is PcmGalaRaceKey {
  return PCM_GALA_RACES.some((race) => race.key === value);
}

export function getPcmGalaRace(key: string | null | undefined) {
  return PCM_GALA_RACES.find((race) => race.key === key) ?? null;
}
