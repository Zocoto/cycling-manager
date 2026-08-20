import type {
  RaceTimelineSnapshot,
  RaceVisualFrame,
  StageSimulationResult,
} from "@/lib/game/race-simulation";

export function getRaceVisualTimeline(
  simulation: StageSimulationResult,
): RaceVisualFrame[] {
  if (simulation.visualTimeline?.length) {
    return simulation.visualTimeline;
  }

  return simulation.timeline.map((snapshot, sourceTimelineIndex) => ({
    segmentNumber: snapshot.segmentNumber,
    completedDistanceKm: snapshot.completedDistanceKm,
    groups: snapshot.groups,
    sourceTimelineIndex,
  }));
}

export function getRaceVisualFrameAtProgress(
  timeline: RaceVisualFrame[],
  progress: number,
): RaceVisualFrame | null {
  if (timeline.length === 0) return null;

  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const index = Math.min(
    timeline.length - 1,
    Math.floor(normalizedProgress * timeline.length),
  );
  return timeline[index] ?? null;
}

export function getRaceVisualFrameForSegment({
  timeline,
  sourceTimelineIndex,
  progress,
}: {
  timeline: RaceVisualFrame[];
  sourceTimelineIndex: number;
  progress: number;
}): RaceVisualFrame | null {
  const segmentFrames = timeline.filter(
    (frame) => frame.sourceTimelineIndex === sourceTimelineIndex,
  );
  return getRaceVisualFrameAtProgress(segmentFrames, progress);
}

export function applyRaceVisualFrame(
  snapshot: RaceTimelineSnapshot,
  frame: RaceVisualFrame | null,
): RaceTimelineSnapshot {
  if (!frame) return snapshot;

  return {
    ...snapshot,
    segmentNumber: frame.segmentNumber,
    completedDistanceKm: frame.completedDistanceKm,
    groups: frame.groups,
  };
}
