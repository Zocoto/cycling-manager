import type { RaceStageSegment } from "./race-profiles";

export const ROAD_SIMULATION_TICK_KM = 2;

export type BreakawayMomentumInput = {
  previousMomentum: number;
  raceProgress: number;
  gapSeconds: number;
  targetGapSeconds: number;
  breakawaySize: number;
  pelotonSize: number;
  breakawayAverageEnergy: number;
  pelotonAverageEnergy: number;
  chasePressure: number;
  selectiveTerrainShare: number;
  likelyMassSprint: boolean;
  randomRoll: number;
};

/**
 * Re-evaluates the breakaway's ability to stay clear from the current race
 * state. The value deliberately keeps some inertia so that a single roll can
 * never decide the stage, while changes of energy, gap or chase progressively
 * alter the balance of power.
 */
export function evolveBreakawayMomentum({
  previousMomentum,
  raceProgress,
  gapSeconds,
  targetGapSeconds,
  breakawaySize,
  pelotonSize,
  breakawayAverageEnergy,
  pelotonAverageEnergy,
  chasePressure,
  selectiveTerrainShare,
  likelyMassSprint,
  randomRoll,
}: BreakawayMomentumInput) {
  if (breakawaySize <= 0) return 0;

  const gapHealth = clamp(
    gapSeconds / Math.max(45, targetGapSeconds),
    0,
    1.35,
  );
  const energyEdge = clamp(
    0.5 + (breakawayAverageEnergy - pelotonAverageEnergy) / 70,
    0,
    1,
  );
  const cooperation = clamp(
    0.22 + Math.log2(breakawaySize + 1) * 0.19,
    0.22,
    0.92,
  );
  const overcrowdingPenalty = clamp((breakawaySize - 18) * 0.018, 0, 0.18);
  const fieldLeverage = clamp(
    breakawaySize / Math.max(1, pelotonSize + breakawaySize),
    0,
    0.42,
  );
  const terrainOpportunity = clamp(selectiveTerrainShare, 0, 1);
  const lateSprintPenalty =
    likelyMassSprint && raceProgress > 0.5
      ? (raceProgress - 0.5) * 0.42
      : 0;
  const liveTarget = clamp(
    gapHealth * 0.24 +
      energyEdge * 0.2 +
      cooperation * 0.17 +
      fieldLeverage * 0.32 +
      terrainOpportunity * 0.17 +
      (1 - clamp(chasePressure, 0, 1)) * 0.22 -
      overcrowdingPenalty -
      lateSprintPenalty,
    0,
    1,
  );
  const inertia = raceProgress < 0.35 ? 0.58 : 0.68;
  const randomImpulse = (clamp(randomRoll, 0, 1) - 0.5) * 0.08;

  return clamp(
    previousMomentum * inertia + liveTarget * (1 - inertia) + randomImpulse,
    0,
    1,
  );
}

export function getContextualBreakawayGapCeiling({
  raceProgress,
  breakawaySize,
  pelotonSize,
  chasePressure,
  pelotonHasGivenUp,
}: {
  raceProgress: number;
  breakawaySize: number;
  pelotonSize: number;
  chasePressure: number;
  pelotonHasGivenUp: boolean;
}) {
  const fieldShare = breakawaySize / Math.max(1, breakawaySize + pelotonSize);
  const earlyControl = raceProgress < 0.25 ? 0.72 + raceProgress * 1.12 : 1;
  const ceiling =
    (430 +
      (1 - clamp(chasePressure, 0, 1)) * 330 +
      fieldShare * 420 +
      (pelotonHasGivenUp ? 720 : 0)) *
    earlyControl;

  return Math.round(clamp(ceiling, 360, 1_800));
}

/** The morning move scales with the actual field rather than a fixed cap. */
export function getContextualBreakawayMaximum({
  riderCount,
  teamCount,
}: {
  riderCount: number;
  teamCount: number;
}) {
  if (riderCount <= 0) return 0;
  const fieldLimit = Math.ceil(riderCount * 0.3);
  const cooperationLimit = Math.max(
    2,
    teamCount + Math.ceil(teamCount * 0.15),
  );
  return Math.min(
    riderCount,
    Math.max(2, Math.min(fieldLimit, cooperationLimit)),
  );
}

/**
 * Keeps the authored 10 km profile segments as the public timeline contract,
 * but gives the physical simulation smaller distance steps internally.
 */
export function splitRaceSegmentIntoSimulationTicks(
  segment: RaceStageSegment,
  maximumTickDistanceKm = ROAD_SIMULATION_TICK_KM,
) {
  const safeMaximum = Math.max(0.25, maximumTickDistanceKm);
  const tickCount = Math.max(1, Math.ceil(segment.distanceKm / safeMaximum));
  const regularDistance = segment.distanceKm / tickCount;

  return Array.from({ length: tickCount }, (_, tickIndex) => ({
    ...segment,
    distanceKm:
      tickIndex === tickCount - 1
        ? segment.distanceKm - regularDistance * (tickCount - 1)
        : regularDistance,
    prime: tickIndex === tickCount - 1 ? segment.prime : null,
  }));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
