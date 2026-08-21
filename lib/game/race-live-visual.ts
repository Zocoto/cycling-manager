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
  if (timeline.length === 1) return timeline[0] ?? null;

  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const exactIndex = normalizedProgress * (timeline.length - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.min(timeline.length - 1, lowerIndex + 1);
  return interpolateRaceVisualFrames(
    timeline[lowerIndex],
    timeline[upperIndex],
    exactIndex - lowerIndex,
  );
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

function interpolateRaceVisualFrames(
  from: RaceVisualFrame,
  to: RaceVisualFrame,
  progress: number,
): RaceVisualFrame {
  const amount = Math.max(0, Math.min(1, progress));
  if (amount <= 0 || from === to) return from;
  if (amount >= 1) return to;

  const selected = amount < 0.5 ? from : to;
  const counterpart = amount < 0.5 ? to : from;
  const counterpartGroupById = new Map(
    counterpart.groups.map((group) => [group.id, group]),
  );
  const groups = selected.groups.map((group) => {
    const matchingGroup = counterpartGroupById.get(group.id);
    if (!matchingGroup) return group;
    const fromGroup =
      from.groups.find((candidate) => candidate.id === group.id) ?? group;
    const toGroup =
      to.groups.find((candidate) => candidate.id === group.id) ?? group;
    return {
      ...group,
      gapToLeaderSeconds: interpolateNumber(
        fromGroup.gapToLeaderSeconds,
        toGroup.gapToLeaderSeconds,
        amount,
      ),
      averageEnergy: interpolateNumber(
        fromGroup.averageEnergy,
        toGroup.averageEnergy,
        amount,
      ),
      elapsedTimeSeconds:
        fromGroup.elapsedTimeSeconds === undefined ||
        toGroup.elapsedTimeSeconds === undefined
          ? group.elapsedTimeSeconds
          : interpolateNumber(
              fromGroup.elapsedTimeSeconds,
              toGroup.elapsedTimeSeconds,
              amount,
            ),
    };
  });

  return {
    ...selected,
    completedDistanceKm: interpolateNumber(
      from.completedDistanceKm,
      to.completedDistanceKm,
      amount,
    ),
    groups,
    frontDynamics: interpolateFrontDynamics(
      from.frontDynamics,
      to.frontDynamics,
      amount,
    ),
  };
}

function interpolateFrontDynamics(
  from: RaceVisualFrame["frontDynamics"],
  to: RaceVisualFrame["frontDynamics"],
  progress: number,
) {
  if (!from) return to;
  if (!to) return from;
  return {
    breakawayCooperation: interpolateNumber(
      from.breakawayCooperation,
      to.breakawayCooperation,
      progress,
    ),
    chasePressure: interpolateNumber(
      from.chasePressure,
      to.chasePressure,
      progress,
    ),
    activeRelayRiderIds:
      progress < 0.5
        ? from.activeRelayRiderIds
        : to.activeRelayRiderIds,
  };
}

function interpolateNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
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
