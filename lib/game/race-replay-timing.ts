import type { RaceStageSegment } from "./race-profiles";
import type { StageSimulationResult } from "./race-simulation";

export const RACE_REPLAY_SPEEDS = [1, 2, 4, 8, 16, 32, 64, 128] as const;
export type RaceReplaySpeed = (typeof RACE_REPLAY_SPEEDS)[number];

export function isRaceReplaySpeed(value: number): value is RaceReplaySpeed {
  return RACE_REPLAY_SPEEDS.some((speed) => speed === value);
}

/** Presentation only: never changes the frozen sporting timeline or results. */
export function buildRaceReplayTiming(
  simulation: Pick<StageSimulationResult, "timeline" | "results">,
  segments: readonly Pick<RaceStageSegment, "distanceKm">[],
) {
  const cumulativeKm = [0];
  for (const [index, snapshot] of simulation.timeline.entries()) {
    const inputDistance = segments[index]?.distanceKm;
    const recordedDistance = snapshot.completedDistanceKm - (simulation.timeline[index - 1]?.completedDistanceKm ?? 0);
    const distance = positive(inputDistance) ? inputDistance : positive(recordedDistance) ? recordedDistance : 1;
    cumulativeKm.push(cumulativeKm[index] + distance);
  }
  const count = simulation.timeline.length;
  const winner = simulation.results.find((result) => result.status === "finished" && result.rank === 1);
  const winnerSeconds = winner?.elapsedTimeSeconds;
  const winnerMs = positive(winnerSeconds) ? winnerSeconds * 1_000 : null;
  // Very old locks may have no group clocks. Use their winning time and
  // distance between known anchors, or a realistic 40 km/h if none exist.
  const fallbackMsPerKm = winnerMs && cumulativeKm[count] > 0 ? winnerMs / cumulativeKm[count] : 90_000;
  const anchors: Array<{ index: number; timeMs: number }> = [{ index: 0, timeMs: 0 }];
  for (const [index, snapshot] of simulation.timeline.entries()) {
    const clocks = snapshot.groups.map((group) => group.elapsedTimeSeconds).filter(positive);
    const timeMs = index === count - 1 && winnerMs !== null
      ? winnerMs
      : clocks.length > 0 ? Math.min(...clocks) * 1_000 : null;
    const previous = anchors.at(-1)!;
    if (timeMs !== null && timeMs > previous.timeMs &&
      (winnerMs === null || index === count - 1 || timeMs < winnerMs)) {
      anchors.push({ index: index + 1, timeMs });
    }
  }
  const last = anchors.at(-1)!;
  if (last.index < count) {
    anchors.push({ index: count, timeMs: last.timeMs + (cumulativeKm[count] - cumulativeKm[last.index]) * fallbackMsPerKm });
  }
  const timesMs = new Array<number>(count + 1).fill(0);
  for (let anchorIndex = 1; anchorIndex < anchors.length; anchorIndex += 1) {
    const from = anchors[anchorIndex - 1], to = anchors[anchorIndex];
    for (let index = from.index + 1; index <= to.index; index += 1) {
      timesMs[index] = from.timeMs + (to.timeMs - from.timeMs) *
        (cumulativeKm[index] - cumulativeKm[from.index]) / (cumulativeKm[to.index] - cumulativeKm[from.index]);
    }
  }
  const segmentDurationsMs = simulation.timeline.map((_, index) => timesMs[index + 1] - timesMs[index]);
  const finalMeters = count > 0 ? (cumulativeKm[count] - cumulativeKm[count - 1]) * 1_000 : 1_000;
  const finalDurationMs = segmentDurationsMs.at(-1) ?? 90_000;
  return {
    segmentDurationsMs,
    segmentStartTimesMs: timesMs.slice(0, -1),
    totalDurationMs: timesMs[count],
    finalApproachDurationMs: finalDurationMs * Math.max(0, finalMeters - 1_000) / finalMeters,
    // The finish helper takes a full-kilometre duration, including when the
    // actual last sector is shorter than one kilometre.
    finalKilometerDurationMs: finalDurationMs * 1_000 / finalMeters,
  };
}

function positive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
