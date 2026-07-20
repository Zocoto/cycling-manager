import type { RaceProfileType } from "./race-calendar";

export const STANDARD_RACE_SEGMENT_KM = 10;

export type SegmentTerrain = "flat" | "climb" | "descent";
export type SegmentSurface = "asphalt" | "cobbles";
export type RacePrimeType = "mountain" | "intermediate_sprint";
export type MountainPrimeCategory = "HC" | "1" | "2" | "3" | "4";

export type RaceSegmentPrime = {
  type: RacePrimeType;
  category: MountainPrimeCategory | null;
  pointsScale: number[];
};

export type RaceStageSegment = {
  segmentNumber: number;
  distanceKm: number;
  terrain: SegmentTerrain;
  averageGradientPct: number;
  surface: SegmentSurface;
  prime: RaceSegmentPrime | null;
};

export const INTERMEDIATE_SPRINT_POINTS = [
  20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

export const MOUNTAIN_PRIME_POINTS: Record<
  MountainPrimeCategory,
  number[]
> = {
  HC: [20, 15, 12, 10, 8, 6, 4, 2],
  "1": [10, 8, 6, 4, 2, 1],
  "2": [5, 3, 2, 1],
  "3": [2, 1],
  "4": [1],
};

type BuildRaceSegmentsInput = {
  distanceKm: number;
  profileType: RaceProfileType;
  seed: string | number;
  includeTourPrimes?: boolean;
};

/**
 * Produit le profil détaillé qui sert à la simulation et à l'affichage.
 * Une même graine donne toujours exactement le même parcours.
 */
export function buildRaceSegments({
  distanceKm,
  profileType,
  seed,
  includeTourPrimes = false,
}: BuildRaceSegmentsInput): RaceStageSegment[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("La distance de l’étape doit être strictement positive.");
  }

  const segmentCount = Math.ceil(distanceKm / STANDARD_RACE_SEGMENT_KM);
  const random = createSeededRandom(seed);
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const segmentNumber = index + 1;
    const remainingDistance = distanceKm - index * STANDARD_RACE_SEGMENT_KM;
    const distance = Math.min(STANDARD_RACE_SEGMENT_KM, remainingDistance);
    const terrain = getTerrain(profileType, index, segmentCount, random);
    const surface = getSurface(profileType, index, segmentCount, random);

    return {
      segmentNumber,
      distanceKm: round(distance, 2),
      terrain,
      averageGradientPct: getGradient(profileType, terrain, random),
      surface,
      prime: null,
    } satisfies RaceStageSegment;
  });

  if (includeTourPrimes) {
    placeTourPrimes(segments);
  }

  return segments;
}

export function getStageDistance(segments: RaceStageSegment[]) {
  return round(
    segments.reduce((total, segment) => total + segment.distanceKm, 0),
    2
  );
}

function getTerrain(
  profileType: RaceProfileType,
  index: number,
  segmentCount: number,
  random: () => number
): SegmentTerrain {
  const progress = (index + 0.5) / segmentCount;

  if (
    profileType === "flat" ||
    profileType === "sprint" ||
    profileType === "time_trial"
  ) {
    if (index > 1 && index < segmentCount - 2 && random() > 0.9) {
      return random() > 0.5 ? "climb" : "descent";
    }

    return "flat";
  }

  if (profileType === "hilly") {
    const pattern: SegmentTerrain[] = [
      "flat",
      "climb",
      "climb",
      "descent",
      "flat",
      "climb",
      "descent",
    ];
    return pattern[index % pattern.length];
  }

  if (profileType === "mountain") {
    if (progress < 0.12) {
      return "flat";
    }

    const pattern: SegmentTerrain[] = [
      "climb",
      "climb",
      "climb",
      "descent",
      "descent",
      "flat",
    ];
    const terrain = pattern[(index - 1 + pattern.length) % pattern.length];

    if (progress > 0.82) {
      return index === segmentCount - 1 ? "climb" : terrain;
    }

    return terrain;
  }

  if (profileType === "cobbles") {
    const pattern: SegmentTerrain[] = [
      "flat",
      "flat",
      "climb",
      "descent",
      "flat",
    ];
    return pattern[index % pattern.length];
  }

  const mixedPattern: SegmentTerrain[] = [
    "flat",
    "climb",
    "descent",
    "flat",
    "climb",
    "climb",
    "descent",
  ];
  return mixedPattern[index % mixedPattern.length];
}

function getSurface(
  profileType: RaceProfileType,
  index: number,
  segmentCount: number,
  random: () => number
): SegmentSurface {
  if (profileType !== "cobbles") {
    return "asphalt";
  }

  const isNeutralizedEdge = index === 0 || index === segmentCount - 1;
  return !isNeutralizedEdge && (index % 3 !== 0 || random() > 0.72)
    ? "cobbles"
    : "asphalt";
}

function getGradient(
  profileType: RaceProfileType,
  terrain: SegmentTerrain,
  random: () => number
) {
  if (terrain === "flat") {
    return 0;
  }

  const isMountain = profileType === "mountain";
  const isHilly = profileType === "hilly" || profileType === "mixed";
  const minimum = isMountain ? 5.2 : isHilly ? 2.8 : 1.5;
  const spread = isMountain ? 4.6 : isHilly ? 3.5 : 2.5;
  const unsignedGradient = round(minimum + random() * spread, 1);

  return terrain === "climb" ? unsignedGradient : -unsignedGradient;
}

function placeTourPrimes(segments: RaceStageSegment[]) {
  const mountainFinishIndexes = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment, index }) => {
      const next = segments[index + 1];
      return (
        segment.terrain === "climb" &&
        (!next || next.terrain !== "climb")
      );
    })
    .map(({ index }) => index);

  for (const index of mountainFinishIndexes) {
    const segment = segments[index];
    const climbLength = getConsecutiveClimbDistance(segments, index);
    const category = getMountainCategory(
      climbLength,
      segment.averageGradientPct
    );

    segment.prime = {
      type: "mountain",
      category,
      pointsScale: MOUNTAIN_PRIME_POINTS[category],
    };
  }

  const targetIndex = Math.max(1, Math.round(segments.length * 0.42) - 1);
  const sprintIndex = findNearestFlatSegment(segments, targetIndex);

  if (sprintIndex !== null && segments[sprintIndex].prime === null) {
    segments[sprintIndex].prime = {
      type: "intermediate_sprint",
      category: null,
      pointsScale: INTERMEDIATE_SPRINT_POINTS,
    };
  }
}

function getConsecutiveClimbDistance(
  segments: RaceStageSegment[],
  finishIndex: number
) {
  let total = 0;

  for (let index = finishIndex; index >= 0; index -= 1) {
    if (segments[index].terrain !== "climb") {
      break;
    }
    total += segments[index].distanceKm;
  }

  return total;
}

function getMountainCategory(
  climbLengthKm: number,
  gradientPct: number
): MountainPrimeCategory {
  const difficulty = climbLengthKm * Math.max(gradientPct, 1);

  if (difficulty >= 260) return "HC";
  if (difficulty >= 180) return "1";
  if (difficulty >= 110) return "2";
  if (difficulty >= 55) return "3";
  return "4";
}

function findNearestFlatSegment(
  segments: RaceStageSegment[],
  targetIndex: number
) {
  for (let offset = 0; offset < segments.length; offset += 1) {
    const candidates = [targetIndex + offset, targetIndex - offset];
    const match = candidates.find(
      (index) =>
        index >= 0 &&
        index < segments.length - 1 &&
        segments[index].terrain === "flat" &&
        segments[index].prime === null
    );

    if (match !== undefined) {
      return match;
    }
  }

  return null;
}

function createSeededRandom(seed: string | number) {
  let state = hashSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string | number) {
  const value = String(seed);
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
