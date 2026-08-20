import type { RaceRole } from "./race-simulation";
import type { RaceStageSegment } from "./race-profiles";

export type BreakawayRelayCandidate = {
  riderId: string;
  teamId: string;
  energy: number;
  breakawayRating: number;
  enduranceRating: number;
  role: RaceRole;
  hasLocomotive: boolean;
  hasPanache: boolean;
};

export type BreakawayCooperationState = {
  cooperation: number;
  paceTimeMultiplier: number;
  activeRelayRiderIds: string[];
  relayLoadByRiderId: Record<string, number>;
};

export const INITIAL_BREAKAWAY_COOPERATION_STATE = {
  cooperation: 0.55,
  paceTimeMultiplier: 1,
  activeRelayRiderIds: [],
  relayLoadByRiderId: {},
} satisfies BreakawayCooperationState;

export function evolveBreakawayCooperation({
  previousState,
  candidates,
  tickIndex,
  raceProgress,
  gapSeconds,
  chasePressure,
  segment,
  isWet,
  frontGroupIsYielding,
  frontGroupIsUncontested,
}: {
  previousState: BreakawayCooperationState;
  candidates: BreakawayRelayCandidate[];
  tickIndex: number;
  raceProgress: number;
  gapSeconds: number;
  chasePressure: number;
  segment: RaceStageSegment;
  isWet: boolean;
  frontGroupIsYielding: boolean;
  frontGroupIsUncontested: boolean;
}): BreakawayCooperationState {
  if (candidates.length === 0) {
    return INITIAL_BREAKAWAY_COOPERATION_STATE;
  }

  const orderedCandidates = [...candidates].sort((left, right) =>
    left.riderId.localeCompare(right.riderId),
  );
  if (frontGroupIsYielding) {
    return {
      cooperation: smooth(previousState.cooperation, 0.12, 0.52),
      paceTimeMultiplier: 1.035,
      activeRelayRiderIds: [],
      relayLoadByRiderId: Object.fromEntries(
        orderedCandidates.map((candidate) => [candidate.riderId, 1]),
      ),
    };
  }

  const averageEnergy = average(
    orderedCandidates.map((candidate) => candidate.energy),
  );
  const energySpread = standardDeviation(
    orderedCandidates.map((candidate) => candidate.energy),
  );
  const teamDiversity =
    new Set(orderedCandidates.map((candidate) => candidate.teamId)).size /
    orderedCandidates.length;
  const optimalGroupSize =
    orderedCandidates.length === 1
      ? 0.76
      : clamp(
          1 - Math.max(0, Math.abs(orderedCandidates.length - 6) - 2) / 22,
          0.38,
          1,
        );
  const coordination = clamp(
    0.82 - Math.abs(teamDiversity - 0.58) * 0.24,
    0.68,
    0.84,
  );
  const energyHealth = smoothstep(18, 78, averageEnergy);
  const energyCohesion = 1 - clamp(energySpread / 38, 0, 1);
  const chaseUrgency = smoothstep(0.18, 0.86, chasePressure);
  const comfortableGapPenalty = smoothstep(300, 720, gapSeconds) * 0.12;
  const finaleDistrust =
    smoothstep(0.7, 0.97, raceProgress) * (0.12 + teamDiversity * 0.16);
  const terrainAdjustment =
    segment.surface === "cobbles"
      ? 0.04
      : segment.terrain === "climb"
        ? -0.035
        : segment.terrain === "descent"
          ? -0.06
          : 0.025;
  const weatherPenalty = isWet ? 0.025 : 0;
  const uncontestedPenalty = frontGroupIsUncontested ? 0.18 : 0;
  const targetCooperation = clamp(
    0.08 +
      optimalGroupSize * 0.22 +
      coordination * 0.15 +
      energyHealth * 0.18 +
      energyCohesion * 0.12 +
      chaseUrgency * 0.2 +
      terrainAdjustment -
      comfortableGapPenalty -
      finaleDistrust -
      weatherPenalty -
      uncontestedPenalty,
    0.08,
    0.94,
  );
  const cooperation = smooth(
    previousState.cooperation,
    targetCooperation,
    raceProgress < 0.55 ? 0.34 : 0.42,
  );
  const activeRelayCount = clampInteger(
    Math.round(
      orderedCandidates.length * (0.2 + cooperation * 0.52),
    ),
    1,
    orderedCandidates.length,
  );
  const rotationOffset = tickIndex % orderedCandidates.length;
  const scoredCandidates = orderedCandidates
    .map((candidate, index) => {
      const rotationDistance =
        (index - rotationOffset + orderedCandidates.length) %
        orderedCandidates.length;
      const rotationPriority =
        1 - rotationDistance / Math.max(1, orderedCandidates.length - 1);
      const roleWillingness =
        candidate.role === "free_agent" ||
        candidate.role === "mountain_classification"
          ? 0.08
          : candidate.role === "domestique"
            ? 0.045
            : candidate.role === "leader" || candidate.role === "sprinter"
              ? -0.07
              : 0;

      return {
        ...candidate,
        score:
          clamp(candidate.energy / 100, 0, 1) * 0.31 +
          clamp(candidate.breakawayRating / 100, 0, 1) * 0.22 +
          clamp(candidate.enduranceRating / 100, 0, 1) * 0.18 +
          rotationPriority * 0.2 +
          roleWillingness +
          (candidate.hasLocomotive ? 0.1 : 0) +
          (candidate.hasPanache ? 0.055 : 0),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.riderId.localeCompare(right.riderId),
    );
  const activeRelayRiderIds = scoredCandidates
    .slice(0, activeRelayCount)
    .map((candidate) => candidate.riderId);
  const activeRelaySet = new Set(activeRelayRiderIds);
  const shelteredLoad = clamp(0.64 + (1 - cooperation) * 0.16, 0.64, 0.8);
  const workingLoad =
    orderedCandidates.length === 1
      ? 1
      : clamp(
          (orderedCandidates.length -
            (orderedCandidates.length - activeRelayCount) * shelteredLoad) /
            activeRelayCount,
          1,
          1.85,
        );
  const relayLoadByRiderId = Object.fromEntries(
    orderedCandidates.map((candidate) => [
      candidate.riderId,
      activeRelaySet.has(candidate.riderId) ? workingLoad : shelteredLoad,
    ]),
  );
  const paceTimeMultiplier = clamp(
    1 + (0.58 - cooperation) * 0.075,
    0.968,
    1.038,
  );

  return {
    cooperation,
    paceTimeMultiplier,
    activeRelayRiderIds,
    relayLoadByRiderId,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  return Math.sqrt(
    average(values.map((value) => (value - mean) ** 2)),
  );
}

function smooth(previous: number, target: number, response: number) {
  return clamp(previous + (target - previous) * response, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.round(clamp(value, minimum, maximum));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
