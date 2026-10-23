import type { RaceProfileType } from "./race-calendar";
import type { RaceStageSegment } from "./race-profiles";

// This deliberately narrow geometry-based gameplay convention is not a claim
// to infer the actual roughness of a road. Traditional cobbled races keep their
// existing physics; only late, short, alternating flat urban circuits qualify.
const GEOMETRY_EPSILON = 1e-8;
const MINIMUM_RACE_DISTANCE_KM = 100;
const MINIMUM_ISLAND_COUNT = 4;
const MAXIMUM_ISLAND_COUNT = 8;
const MAXIMUM_ISLAND_DISTANCE_KM = 4;
const MINIMUM_ASPHALT_SEPARATION_KM = 3;
const MAXIMUM_COBBLED_GRADIENT_PCT = 0.5;
const MAXIMUM_ASCENDING_GRADIENT_PCT = 3;
const MAXIMUM_ASCENT_METERS = 500;
const MAXIMUM_COBBLED_DISTANCE_SHARE = 0.125;
const MINIMUM_CIRCUIT_START_SHARE = 0.75;
const MAXIMUM_FINAL_RUN_IN_KM = 5;

type CobbledIsland = {
  startKm: number;
  endKm: number;
  distanceKm: number;
};

type NormalizeUrbanCobblesSegmentsInput = {
  stageType: string;
  profileType: RaceProfileType;
  segments: RaceStageSegment[];
};

function hasUrbanCircuitGeometry({
  stageType,
  profileType,
  segments,
}: NormalizeUrbanCobblesSegmentsInput) {
  if (
    stageType !== "road" ||
    (profileType !== "flat" && profileType !== "sprint") ||
    segments.length === 0
  ) {
    return false;
  }

  const islands: CobbledIsland[] = [];
  let currentIsland: CobbledIsland | null = null;
  let completedDistanceKm = 0;
  let cobbledDistanceKm = 0;
  let ascentMeters = 0;

  for (const segment of segments) {
    if (
      !Number.isFinite(segment.distanceKm) ||
      segment.distanceKm <= 0 ||
      !Number.isFinite(segment.averageGradientPct) ||
      !["flat", "climb", "descent"].includes(segment.terrain) ||
      !["asphalt", "cobbles"].includes(segment.surface) ||
      segment.averageGradientPct >
        MAXIMUM_ASCENDING_GRADIENT_PCT + GEOMETRY_EPSILON
    ) {
      return false;
    }

    const startKm = completedDistanceKm;
    completedDistanceKm += segment.distanceKm;
    ascentMeters +=
      segment.distanceKm * Math.max(0, segment.averageGradientPct) * 10;

    if (
      !Number.isFinite(completedDistanceKm) ||
      !Number.isFinite(ascentMeters) ||
      ascentMeters > MAXIMUM_ASCENT_METERS + GEOMETRY_EPSILON
    ) {
      return false;
    }

    if (segment.surface === "cobbles") {
      if (
        segment.terrain !== "flat" ||
        Math.abs(segment.averageGradientPct) >
          MAXIMUM_COBBLED_GRADIENT_PCT + GEOMETRY_EPSILON
      ) {
        return false;
      }

      cobbledDistanceKm += segment.distanceKm;
      if (currentIsland) {
        currentIsland.distanceKm += segment.distanceKm;
        currentIsland.endKm = completedDistanceKm;
      } else {
        const previousIsland = islands.at(-1);
        if (
          previousIsland &&
          startKm - previousIsland.endKm <
            MINIMUM_ASPHALT_SEPARATION_KM - GEOMETRY_EPSILON
        ) {
          return false;
        }
        currentIsland = {
          startKm,
          endKm: completedDistanceKm,
          distanceKm: segment.distanceKm,
        };
        islands.push(currentIsland);
      }

      if (
        currentIsland.distanceKm >
          MAXIMUM_ISLAND_DISTANCE_KM + GEOMETRY_EPSILON ||
        islands.length > MAXIMUM_ISLAND_COUNT
      ) {
        return false;
      }
    } else {
      currentIsland = null;
    }
  }

  return (
    completedDistanceKm >= MINIMUM_RACE_DISTANCE_KM - GEOMETRY_EPSILON &&
    islands.length >= MINIMUM_ISLAND_COUNT &&
    islands[0].startKm >=
      completedDistanceKm * MINIMUM_CIRCUIT_START_SHARE - GEOMETRY_EPSILON &&
    completedDistanceKm - islands.at(-1)!.endKm <=
      MAXIMUM_FINAL_RUN_IN_KM + GEOMETRY_EPSILON &&
    cobbledDistanceKm <=
      completedDistanceKm * MAXIMUM_COBBLED_DISTANCE_SHARE + GEOMETRY_EPSILON
  );
}

/** Derive, never trust, urban cobbles tags from the complete authored route.
 * No mutation, random draw, database access or per-rider work is performed.
 * Unchanged routes retain their original array and segment references. */
export function normalizeUrbanCobblesSegments(
  input: NormalizeUrbanCobblesSegmentsInput,
): RaceStageSegment[] {
  const qualifies = hasUrbanCircuitGeometry(input);
  let changed = false;
  const normalized = input.segments.map((segment) => {
    if (qualifies && segment.surface === "cobbles") {
      if (segment.cobblesStyle === "urban") return segment;
      changed = true;
      return { ...segment, cobblesStyle: "urban" as const };
    }

    if (segment.cobblesStyle === undefined) return segment;
    changed = true;
    const { cobblesStyle: ignoredStyle, ...ordinarySegment } = segment;
    void ignoredStyle;
    return ordinarySegment;
  });
  return changed ? normalized : input.segments;
}

/** Use on normalized segments. Surface remains cobbled for presentation and
 * unchanged incident rules; the tag selects only the urban pacing policy. */
export function isUrbanCobbles(segment: RaceStageSegment): boolean {
  return (
    segment.cobblesStyle === "urban" &&
    segment.surface === "cobbles" &&
    segment.terrain === "flat" &&
    Number.isFinite(segment.distanceKm) &&
    segment.distanceKm > 0 &&
    segment.distanceKm <= MAXIMUM_ISLAND_DISTANCE_KM + GEOMETRY_EPSILON &&
    Number.isFinite(segment.averageGradientPct) &&
    Math.abs(segment.averageGradientPct) <=
      MAXIMUM_COBBLED_GRADIENT_PCT + GEOMETRY_EPSILON
  );
}
