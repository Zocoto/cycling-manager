import type {
  RaceGroupSnapshot,
  RaceTimelineSnapshot,
  RaceVisualFrame,
  StageSimulationResult,
} from "@/lib/game/race-simulation";

const ROAD_GROUP_VISUAL_MERGE_GAP_SECONDS = 20;

export function getRaceVisualTimeline(
  simulation: StageSimulationResult,
): RaceVisualFrame[] {
  const authoredFrames = simulation.visualTimeline?.length
    ? simulation.visualTimeline
    : simulation.timeline.map((snapshot, sourceTimelineIndex) => ({
        segmentNumber: snapshot.segmentNumber,
        completedDistanceKm: snapshot.completedDistanceKm,
        groups: snapshot.groups,
        sourceTimelineIndex,
      }));

  return authoredFrames.map((frame) =>
    stabilizeRaceVisualFrame(simulation.timeline, frame),
  );
}

function stabilizeRaceVisualFrame(
  officialTimeline: RaceTimelineSnapshot[],
  frame: RaceVisualFrame,
): RaceVisualFrame {
  const officialTo = officialTimeline[frame.sourceTimelineIndex];
  const officialFrom = officialTimeline[frame.sourceTimelineIndex - 1];

  if (!officialTo || !officialFrom) {
    return {
      ...frame,
      groups: mergeNearbyDroppedVisualGroups(cloneRaceGroups(frame.groups)),
    };
  }

  const segmentDistanceKm =
    officialTo.completedDistanceKm - officialFrom.completedDistanceKm;
  const segmentProgress =
    segmentDistanceKm <= 0
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (frame.completedDistanceKm - officialFrom.completedDistanceKm) /
              segmentDistanceKm,
          ),
        );

  // The official snapshot is the sporting source of truth. In particular, the
  // finish engine can rebuild every group under a `finish-group-*` id, so an
  // authored frame at the line must not keep stale pre-finish memberships.
  if (segmentProgress >= 1) {
    return {
      ...frame,
      segmentNumber: officialTo.segmentNumber,
      completedDistanceKm: officialTo.completedDistanceKm,
      groups: cloneRaceGroups(officialTo.groups),
    };
  }

  const fromGroupById = new Map(
    officialFrom.groups.map((group) => [group.id, group]),
  );
  const toGroupById = new Map(
    officialTo.groups.map((group) => [group.id, group]),
  );
  const stabilizedGroups = frame.groups
    .map((group) => {
      const fromGroup = fromGroupById.get(group.id);
      const toGroup = toGroupById.get(group.id);
      if (!fromGroup || !toGroup) {
        return { ...group, riderIds: [...group.riderIds] };
      }

      return {
        ...group,
        riderIds: [...group.riderIds],
        gapToLeaderSeconds: interpolateNumber(
          fromGroup.gapToLeaderSeconds,
          toGroup.gapToLeaderSeconds,
          segmentProgress,
        ),
        averageEnergy: interpolateNumber(
          fromGroup.averageEnergy,
          toGroup.averageEnergy,
          segmentProgress,
        ),
        elapsedTimeSeconds:
          fromGroup.elapsedTimeSeconds === undefined ||
          toGroup.elapsedTimeSeconds === undefined
            ? group.elapsedTimeSeconds
            : interpolateNumber(
                fromGroup.elapsedTimeSeconds,
                toGroup.elapsedTimeSeconds,
                segmentProgress,
              ),
      };
    })
    .sort(
      (first, second) =>
        first.gapToLeaderSeconds - second.gapToLeaderSeconds ||
        first.id.localeCompare(second.id),
    );

  const groupsWithContinuousMembership = interpolateRiderGroupTransitions({
    groups: stabilizedGroups,
    officialFrom,
    officialTo,
    segmentProgress,
    sourceTimelineIndex: frame.sourceTimelineIndex,
  });

  return {
    ...frame,
    groups: mergeNearbyDroppedVisualGroups(groupsWithContinuousMembership),
  };
}

type RiderGroupTransition = {
  fromGroup: RaceGroupSnapshot;
  toGroup: RaceGroupSnapshot;
  riderIds: string[];
};

/**
 * Keeps rider positions continuous when the official engine changes group ids
 * or membership between two snapshots. Authored frames are produced before a
 * few end-of-segment resolutions (catch, delayed-rider recovery, final group
 * rebuild), so relying on group ids alone can otherwise leave a rider at +19 s
 * until the line and make them instantly appear in the leading group.
 */
function interpolateRiderGroupTransitions({
  groups,
  officialFrom,
  officialTo,
  segmentProgress,
  sourceTimelineIndex,
}: {
  groups: RaceGroupSnapshot[];
  officialFrom: RaceTimelineSnapshot;
  officialTo: RaceTimelineSnapshot;
  segmentProgress: number;
  sourceTimelineIndex: number;
}): RaceGroupSnapshot[] {
  const transitions = getRiderGroupTransitions(officialFrom, officialTo);
  if (transitions.length === 0) {
    return deduplicateRiderMembership(groups);
  }

  const transitioningRiderIds = new Set(
    transitions.flatMap((transition) => transition.riderIds),
  );
  const groupsWithoutTransitioningRiders = groups
    .map((group) => ({
      ...group,
      riderIds: group.riderIds.filter(
        (riderId) => !transitioningRiderIds.has(riderId),
      ),
    }))
    .filter((group) => group.riderIds.length > 0);

  const transitionGroups = transitions.map((transition, transitionIndex) => {
    const movingForward =
      transition.toGroup.gapToLeaderSeconds <
      transition.fromGroup.gapToLeaderSeconds;
    const elapsedTimeSeconds =
      transition.fromGroup.elapsedTimeSeconds === undefined ||
      transition.toGroup.elapsedTimeSeconds === undefined
        ? undefined
        : interpolateNumber(
            transition.fromGroup.elapsedTimeSeconds,
            transition.toGroup.elapsedTimeSeconds,
            segmentProgress,
          );

    return {
      id: `visual-transition-${sourceTimelineIndex}-${transitionIndex}`,
      label: movingForward ? "Groupe en poursuite" : "Groupe distancé",
      type: movingForward ? ("chase" as const) : ("dropped" as const),
      riderIds: [...transition.riderIds],
      gapToLeaderSeconds: interpolateNumber(
        transition.fromGroup.gapToLeaderSeconds,
        transition.toGroup.gapToLeaderSeconds,
        segmentProgress,
      ),
      averageEnergy: interpolateNumber(
        transition.fromGroup.averageEnergy,
        transition.toGroup.averageEnergy,
        segmentProgress,
      ),
      ...(elapsedTimeSeconds === undefined ? {} : { elapsedTimeSeconds }),
    } satisfies RaceGroupSnapshot;
  });

  return deduplicateRiderMembership([
    ...groupsWithoutTransitioningRiders,
    ...transitionGroups,
  ]).sort(
    (first, second) =>
      first.gapToLeaderSeconds - second.gapToLeaderSeconds ||
      first.id.localeCompare(second.id),
  );
}

function getRiderGroupTransitions(
  officialFrom: RaceTimelineSnapshot,
  officialTo: RaceTimelineSnapshot,
): RiderGroupTransition[] {
  const fromGroupByRiderId = mapRidersToGroups(officialFrom.groups);
  const toGroupByRiderId = mapRidersToGroups(officialTo.groups);
  const transitionByGroups = new Map<string, RiderGroupTransition>();

  for (const [riderId, fromGroup] of fromGroupByRiderId) {
    const toGroup = toGroupByRiderId.get(riderId);
    if (
      !toGroup ||
      fromGroup.id === toGroup.id ||
      fromGroup.type === "time_trial" ||
      toGroup.type === "time_trial" ||
      Math.abs(
        fromGroup.gapToLeaderSeconds - toGroup.gapToLeaderSeconds,
      ) < 0.01
    ) {
      continue;
    }

    const key = `${fromGroup.id}\u0000${toGroup.id}`;
    const existing = transitionByGroups.get(key);
    if (existing) {
      existing.riderIds.push(riderId);
      continue;
    }
    transitionByGroups.set(key, {
      fromGroup,
      toGroup,
      riderIds: [riderId],
    });
  }

  return [...transitionByGroups.values()];
}

function mapRidersToGroups(groups: RaceGroupSnapshot[]) {
  const groupByRiderId = new Map<string, RaceGroupSnapshot>();
  for (const group of groups) {
    for (const riderId of group.riderIds) {
      if (!groupByRiderId.has(riderId)) {
        groupByRiderId.set(riderId, group);
      }
    }
  }
  return groupByRiderId;
}

function deduplicateRiderMembership(
  groups: RaceGroupSnapshot[],
): RaceGroupSnapshot[] {
  const seenRiderIds = new Set<string>();
  return groups
    .map((group) => ({
      ...group,
      riderIds: group.riderIds.filter((riderId) => {
        if (seenRiderIds.has(riderId)) return false;
        seenRiderIds.add(riderId);
        return true;
      }),
    }))
    .filter((group) => group.riderIds.length > 0);
}

function cloneRaceGroups(groups: RaceGroupSnapshot[]): RaceGroupSnapshot[] {
  return groups.map((group) => ({
    ...group,
    riderIds: [...group.riderIds],
  }));
}

function mergeNearbyDroppedVisualGroups(
  groups: RaceGroupSnapshot[],
): RaceGroupSnapshot[] {
  const mergedGroups: RaceGroupSnapshot[] = [];

  for (const group of groups) {
    const previous = mergedGroups.at(-1);
    if (
      !previous ||
      previous.type !== "dropped" ||
      group.type !== "dropped" ||
      group.gapToLeaderSeconds - previous.gapToLeaderSeconds >
        ROAD_GROUP_VISUAL_MERGE_GAP_SECONDS
    ) {
      mergedGroups.push(group);
      continue;
    }

    const previousWeight = Math.max(1, previous.riderIds.length);
    const groupWeight = Math.max(1, group.riderIds.length);
    const totalWeight = previousWeight + groupWeight;
    const riderIds = [...new Set([...previous.riderIds, ...group.riderIds])];
    const labelSource =
      group.riderIds.length > previous.riderIds.length ? group : previous;

    mergedGroups[mergedGroups.length - 1] = {
      ...labelSource,
      id: `dropped-${[...riderIds].sort().join("-")}`,
      riderIds,
      gapToLeaderSeconds:
        (previous.gapToLeaderSeconds * previousWeight +
          group.gapToLeaderSeconds * groupWeight) /
        totalWeight,
      averageEnergy:
        (previous.averageEnergy * previousWeight +
          group.averageEnergy * groupWeight) /
        totalWeight,
      elapsedTimeSeconds:
        previous.elapsedTimeSeconds === undefined ||
        group.elapsedTimeSeconds === undefined
          ? undefined
          : (previous.elapsedTimeSeconds * previousWeight +
              group.elapsedTimeSeconds * groupWeight) /
            totalWeight,
    };
  }

  return mergedGroups;
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
