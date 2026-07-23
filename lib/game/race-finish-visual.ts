import type {
  FinalBattleScenario,
  RiderSimulationInput,
} from "./race-simulation";

export const FINAL_KILOMETER_DURATION_MS = 8_000;

type SprintVisualRider = Pick<
  RiderSimulationInput,
  "id" | "teamId" | "role"
>;

export type SprintVisualTeam = {
  teamId: string;
  riderIds: string[];
  trainRiderIds: string[];
};

export function buildSprintVisualTeams(
  riders: readonly SprintVisualRider[]
): SprintVisualTeam[] {
  const teams = new Map<
    string,
    SprintVisualTeam & {
      leadoutRiderIds: string[];
      sprinterRiderIds: string[];
    }
  >();

  for (const rider of riders) {
    const team = teams.get(rider.teamId) ?? {
      teamId: rider.teamId,
      riderIds: [],
      trainRiderIds: [],
      leadoutRiderIds: [],
      sprinterRiderIds: [],
    };
    team.riderIds.push(rider.id);
    if (rider.role === "leadout") {
      team.leadoutRiderIds.push(rider.id);
    } else if (rider.role === "sprinter") {
      team.sprinterRiderIds.push(rider.id);
    }
    teams.set(rider.teamId, team);
  }

  return [...teams.values()].map(
    ({
      leadoutRiderIds,
      sprinterRiderIds,
      ...team
    }) => ({
      ...team,
      trainRiderIds: [
        ...leadoutRiderIds,
        ...sprinterRiderIds,
      ],
    })
  );
}

export function keepPassageWinnerVisible({
  orderedRiderIds,
  winnerRiderId,
  maximumVisibleRiders = 5,
}: {
  orderedRiderIds: string[];
  winnerRiderId: string | null;
  maximumVisibleRiders?: number;
}) {
  if (
    winnerRiderId === null ||
    !orderedRiderIds.includes(winnerRiderId)
  ) {
    return orderedRiderIds.slice(0, maximumVisibleRiders);
  }

  return [
    ...orderedRiderIds
      .filter((riderId) => riderId !== winnerRiderId)
      .slice(0, Math.max(0, maximumVisibleRiders - 1)),
    winnerRiderId,
  ];
}

export function getVisibleFinalBattleRiderIds(
  scenario: FinalBattleScenario,
  battleProgress: number
) {
  const progress = clamp(battleProgress, 0, 1);
  const visibleRiderIds = new Set(
    scenario.entryLeaderIds.length > 0
      ? scenario.entryLeaderIds
      : scenario.contenderIds
  );

  scenario.lateJoiners.forEach((lateJoiner, index) => {
    if (
      progress >=
      getLateJoinerRevealProgress(
        lateJoiner.gapToLeaderSeconds,
        index,
        scenario.lateJoiners.length
      )
    ) {
      visibleRiderIds.add(lateJoiner.riderId);
    }
  });

  if (progress >= 1) {
    scenario.contenderIds.forEach((riderId) =>
      visibleRiderIds.add(riderId)
    );
  }

  return scenario.contenderIds.filter((riderId) =>
    visibleRiderIds.has(riderId)
  );
}

export function getFinalReplayMeters({
  startedWithMeters,
  finalSegmentMeters,
  elapsedMs,
  playbackSpeed,
  approachDurationMs,
}: {
  startedWithMeters: number;
  finalSegmentMeters: number;
  elapsedMs: number;
  playbackSpeed: number;
  approachDurationMs: number;
}) {
  const speed = Math.max(0.1, playbackSpeed);
  const lastKilometerStart = Math.min(1_000, startedWithMeters);
  const approachDistance = Math.max(
    0,
    startedWithMeters - lastKilometerStart
  );
  const fullApproachDistance = Math.max(
    1,
    finalSegmentMeters - 1_000
  );
  const currentApproachDurationMs =
    (approachDurationMs * approachDistance) /
    fullApproachDistance /
    speed;

  if (
    approachDistance > 0 &&
    elapsedMs < currentApproachDurationMs
  ) {
    const approachProgress = elapsedMs / currentApproachDurationMs;
    return Math.max(
      lastKilometerStart,
      Math.round(
        startedWithMeters - approachDistance * approachProgress
      )
    );
  }

  const lastKilometerDurationMs =
    (FINAL_KILOMETER_DURATION_MS * lastKilometerStart) /
    1_000 /
    speed;
  const lastKilometerElapsedMs = Math.max(
    0,
    elapsedMs - currentApproachDurationMs
  );
  const lastKilometerProgress =
    lastKilometerDurationMs > 0
      ? lastKilometerElapsedMs / lastKilometerDurationMs
      : 1;

  return Math.max(
    0,
    Math.round(
      lastKilometerStart * (1 - lastKilometerProgress)
    )
  );
}

export function getFinishTargetPosition({
  rank,
  hasFinished,
  finishLinePosition,
}: {
  rank: number;
  hasFinished: boolean;
  finishLinePosition: number;
}) {
  if (!hasFinished) {
    return finishLinePosition - 1.2 - (rank - 1) * 0.72;
  }

  return rank === 1
    ? finishLinePosition + 2.2
    : finishLinePosition - 0.3 - (rank - 2) * 1.05;
}

type SmallGroupFinishPositionInput = {
  riderIndex: number;
  riderCount: number;
  decisiveIndex: number;
  decisiveCount: number;
  droppedIndex: number;
  droppedCount: number;
  lateJoinerGapSeconds: number | null;
  finalProgress: number;
  battleProgress: number;
  visualSeed: number;
  hasFinished: boolean;
  finishLinePosition: number;
};

/**
 * Place les coureurs d'un petit groupe sur une ligne de course lisible.
 * Chaque emplacement d'entrée est unique, puis les coureurs sont rangés dans
 * l'ordre officiel : ceux qui jouent encore la gagne devant, les lâchés derrière.
 */
export function getSmallGroupFinishPosition({
  riderIndex,
  riderCount,
  decisiveIndex,
  decisiveCount,
  droppedIndex,
  droppedCount,
  lateJoinerGapSeconds,
  finalProgress,
  battleProgress,
  visualSeed,
  hasFinished,
  finishLinePosition,
}: SmallGroupFinishPositionInput) {
  const safeRiderCount = Math.max(1, riderCount);
  const entrySlot =
    (riderIndex + Math.abs(visualSeed) % safeRiderCount) % safeRiderCount;
  const entryPosition = safeRiderCount === 1
    ? 62
    : 14 + entrySlot * (68 / (safeRiderCount - 1));
  const lateJoinerPenalty = lateJoinerGapSeconds === null
    ? 0
    : Math.min(14, 5 + lateJoinerGapSeconds * 0.28);
  const readableEntryPosition = Math.max(9, entryPosition - lateJoinerPenalty);

  const leaderTarget = getFinishTargetPosition({
    rank: 1,
    hasFinished,
    finishLinePosition,
  });
  const decisiveSpan = decisiveCount <= 1
    ? 0
    : Math.min(65, (decisiveCount - 1) * 8.1);
  const decisiveSpacing = decisiveCount <= 1
    ? 0
    : decisiveSpan / (decisiveCount - 1);
  const decisiveTail = leaderTarget - decisiveSpan;
  const droppedStart = Math.max(13, decisiveTail - 9);
  const droppedSpacing = droppedCount <= 1
    ? 0
    : Math.min(6.5, (droppedStart - 9) / (droppedCount - 1));
  const finishPosition = decisiveIndex >= 0
    ? leaderTarget - decisiveIndex * decisiveSpacing
    : droppedStart - Math.max(0, droppedIndex) * droppedSpacing;
  const movement =
    Math.sin(finalProgress * 20 + riderIndex * 1.9 + visualSeed) *
    1.6 *
    (1 - battleProgress);

  return clamp(
    readableEntryPosition * (1 - battleProgress) +
      finishPosition * battleProgress +
      movement,
    8,
    92
  );
}

function getLateJoinerRevealProgress(
  gapToLeaderSeconds: number,
  index: number,
  count: number
) {
  const gapFactor = clamp(gapToLeaderSeconds / 60, 0, 1);
  const orderFactor = count > 1 ? index / (count - 1) : 0;
  return clamp(0.24 + gapFactor * 0.28 + orderFactor * 0.2, 0.24, 0.78);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
