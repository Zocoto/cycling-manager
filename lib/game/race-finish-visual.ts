import type { FinalBattleScenario } from "./race-simulation";

export const FINAL_KILOMETER_DURATION_MS = 8_000;

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
