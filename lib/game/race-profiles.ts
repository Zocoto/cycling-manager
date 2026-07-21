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
  const mountainTerrainPlan =
    profileType === "mountain"
      ? buildMountainTerrainPlan(segmentCount, random)
      : null;
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const segmentNumber = index + 1;
    const remainingDistance = distanceKm - index * STANDARD_RACE_SEGMENT_KM;
    const distance = Math.min(STANDARD_RACE_SEGMENT_KM, remainingDistance);
    const terrain =
      mountainTerrainPlan?.[index] ??
      getTerrain(profileType, index, segmentCount, random);
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

  if (profileType === "mountain") {
    ensureMountainSummitFinish(segments);
  }

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

/**
 * Corrige l'étiquette d'une étape lorsque son tracé raconte une autre course.
 * Un grand col suffit à définir une étape de montagne, tandis qu'une côte
 * d'arrivée marquée transforme une journée jusque-là plate en étape vallonnée.
 */
export function resolveRaceProfileType(
  declaredProfileType: RaceProfileType,
  segments: RaceStageSegment[]
): RaceProfileType {
  if (
    segments.length === 0 ||
    declaredProfileType === "time_trial" ||
    declaredProfileType === "cobbles" ||
    declaredProfileType === "mountain"
  ) {
    return declaredProfileType;
  }

  const climbBlocks = getClimbBlocks(segments);
  const hasMajorMountainAscent = climbBlocks.some(
    (climb) => climb.distanceKm >= 30 && climb.averageGradientPct >= 5.5
  );

  if (hasMajorMountainAscent) {
    return "mountain";
  }

  const finishClimb = climbBlocks.find(
    (climb) => climb.finishIndex === segments.length - 1
  );

  if (!finishClimb) {
    return declaredProfileType;
  }

  if (
    finishClimb.distanceKm >= 15 &&
    finishClimb.averageGradientPct >= 5.5
  ) {
    return "mountain";
  }

  if (
    finishClimb.distanceKm >= 3 &&
    finishClimb.averageGradientPct >= 4.5
  ) {
    return "hilly";
  }

  return declaredProfileType;
}

type ClimbBlock = {
  finishIndex: number;
  distanceKm: number;
  averageGradientPct: number;
};

function getClimbBlocks(segments: RaceStageSegment[]): ClimbBlock[] {
  const climbs: ClimbBlock[] = [];
  let distanceKm = 0;
  let weightedGradient = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (segment.terrain === "climb") {
      distanceKm += segment.distanceKm;
      weightedGradient += segment.distanceKm * segment.averageGradientPct;
    }

    const nextSegment = segments[index + 1];
    if (
      segment.terrain === "climb" &&
      (!nextSegment || nextSegment.terrain !== "climb")
    ) {
      climbs.push({
        finishIndex: index,
        distanceKm: round(distanceKm, 2),
        averageGradientPct: round(weightedGradient / distanceKm, 2),
      });
      distanceKm = 0;
      weightedGradient = 0;
    }
  }

  return climbs;
}

function buildMountainTerrainPlan(
  segmentCount: number,
  random: () => number
): SegmentTerrain[] {
  const terrain: SegmentTerrain[] = Array.from(
    { length: segmentCount },
    () => "flat"
  );

  if (segmentCount <= 1) {
    return terrain;
  }

  const approachLength = Math.min(
    2,
    Math.max(1, Math.floor(segmentCount * 0.1))
  );
  const availableForFinish = segmentCount - approachLength;
  const finalClimbLength = Math.min(
    availableForFinish,
    3 + Math.floor(random() * 4)
  );
  const finalClimbStart = segmentCount - finalClimbLength;

  for (let index = finalClimbStart; index < segmentCount; index += 1) {
    terrain[index] = "climb";
  }

  const finalDescentStart = Math.max(
    approachLength,
    finalClimbStart - 2
  );
  for (
    let index = finalDescentStart;
    index < finalClimbStart;
    index += 1
  ) {
    terrain[index] = "descent";
  }

  let cursor = approachLength;
  while (finalDescentStart - cursor >= 3) {
    const remaining = finalDescentStart - cursor;
    const climbLength = Math.min(
      remaining,
      3 + Math.floor(random() * 4)
    );

    for (let offset = 0; offset < climbLength; offset += 1) {
      terrain[cursor + offset] = "climb";
    }
    cursor += climbLength;

    const descentLength = Math.min(2, finalDescentStart - cursor);
    for (let offset = 0; offset < descentLength; offset += 1) {
      terrain[cursor + offset] = "descent";
    }
    cursor += descentLength;

    if (cursor < finalDescentStart) {
      terrain[cursor] = "flat";
      cursor += 1;
    }
  }

  return terrain;
}

function ensureMountainSummitFinish(segments: RaceStageSegment[]) {
  let finalClimbStart = segments.length - 1;

  while (
    finalClimbStart > 0 &&
    segments[finalClimbStart - 1].terrain === "climb"
  ) {
    finalClimbStart -= 1;
  }

  let elevation = 0;
  let highestElevationBeforeFinalClimb = 0;

  for (let index = 0; index < segments.length; index += 1) {
    if (index < finalClimbStart) {
      highestElevationBeforeFinalClimb = Math.max(
        highestElevationBeforeFinalClimb,
        elevation
      );
    }
    const segment = segments[index];
    elevation +=
      segment.distanceKm * segment.averageGradientPct * 10;
  }

  const summitMarginMeters = 100;
  const missingElevation =
    highestElevationBeforeFinalClimb + summitMarginMeters - elevation;

  if (missingElevation <= 0) {
    return;
  }

  const finalClimbDistance = segments
    .slice(finalClimbStart)
    .reduce((total, segment) => total + segment.distanceKm, 0);
  const gradientAdjustment = missingElevation / (finalClimbDistance * 10);

  for (let index = finalClimbStart; index < segments.length; index += 1) {
    segments[index].averageGradientPct = round(
      segments[index].averageGradientPct + gradientAdjustment,
      1
    );
  }
}

function getTerrain(
  profileType: RaceProfileType,
  index: number,
  segmentCount: number,
  random: () => number
): SegmentTerrain {
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
  const minimum = isMountain ? 5.8 : isHilly ? 2.8 : 1.5;
  const spread = isMountain ? 3.6 : isHilly ? 3.5 : 2.5;
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
