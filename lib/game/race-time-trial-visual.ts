import type {
  RiderSimulationInput,
  RaceTimelineSnapshot,
  SimulationStageType,
  StageSimulationInput,
  StageSimulationResult,
} from "./race-simulation";

export type TimeTrialVisualUnit = {
  id: string;
  label: string;
  riderIds: string[];
  startOrder: number;
  startSeconds: number;
  elapsedTimeSeconds: number;
  pacingBias: number;
};

export type TimeTrialVisualFrameUnit = TimeTrialVisualUnit & {
  rawProgress: number;
  progress: number;
};

export function getTimeTrialStartIntervalSeconds(
  starterCount: number,
  stageType: SimulationStageType,
) {
  if (stageType === "team_time_trial") {
    if (starterCount <= 8) return 240;
    if (starterCount <= 16) return 180;
    return 120;
  }

  if (starterCount <= 20) return 180;
  if (starterCount <= 50) return 120;
  if (starterCount <= 100) return 90;
  return 60;
}

export function buildTimeTrialStartSchedule({
  input,
  simulation,
}: {
  input: Pick<
    StageSimulationInput,
    "stageType" | "riders" | "generalClassification"
  >;
  simulation: Pick<StageSimulationResult, "results">;
}): TimeTrialVisualUnit[] {
  const resultByRiderId = new Map(
    simulation.results.map((result) => [result.riderId, result]),
  );
  const gcRankByRiderId = getGeneralClassificationRankByRiderId(
    input.generalClassification,
  );

  const starters =
    input.stageType === "team_time_trial"
      ? buildTeamStarters(input.riders, resultByRiderId, gcRankByRiderId)
      : buildIndividualStarters(
          input.riders,
          resultByRiderId,
          gcRankByRiderId,
        );
  const interval = getTimeTrialStartIntervalSeconds(
    starters.length,
    input.stageType,
  );

  return starters.map((starter, index) => ({
    ...starter,
    startOrder: index + 1,
    startSeconds: index * interval,
    pacingBias: getPacingBias(starter.id),
  }));
}

export function getTimeTrialVisualFrame(
  schedule: readonly TimeTrialVisualUnit[],
  raceProgress: number,
  timeline: readonly RaceTimelineSnapshot[] = [],
) {
  const totalDurationSeconds = Math.max(
    1,
    ...schedule.map(
      (starter) => starter.startSeconds + starter.elapsedTimeSeconds,
    ),
  );
  const raceElapsedSeconds = clamp(raceProgress, 0, 1) * totalDurationSeconds;
  const active: TimeTrialVisualFrameUnit[] = [];
  const finished: TimeTrialVisualUnit[] = [];

  for (const starter of schedule) {
    const rawProgress =
      (raceElapsedSeconds - starter.startSeconds) /
      Math.max(1, starter.elapsedTimeSeconds);
    if (rawProgress >= 1) {
      finished.push(starter);
      continue;
    }
    if (rawProgress <= 0) continue;
    const timelineProgress = getRecordedCourseProgress(
      starter,
      raceElapsedSeconds - starter.startSeconds,
      timeline,
    );


    active.push({
      ...starter,
      rawProgress,
      progress: timelineProgress ?? clamp(
        rawProgress +
          starter.pacingBias * Math.sin(Math.PI * rawProgress),
        0,
        1,
      ),
    });
  }

  const next = schedule.find(
    (starter) => starter.startSeconds > raceElapsedSeconds,
  );

  return {
    totalDurationSeconds,
    raceElapsedSeconds,
    active: active.sort(
      (first, second) =>
        second.progress - first.progress ||
        first.startOrder - second.startOrder,
    ),
    finished,
    next,
    secondsUntilNext: next
      ? Math.max(0, Math.ceil(next.startSeconds - raceElapsedSeconds))
      : null,
  };
}


export type TimeTrialSplitStanding = {
  id: string;
  label: string;
  riderIds: string[];
  elapsedTimeSeconds: number;
  gapToLeaderSeconds: number;
  passageOrder: number;
};

export function selectSpacedTimeTrialUnits(
  units: readonly TimeTrialVisualFrameUnit[],
  minimumProgressGap = 0.11,
  limit = 7,
) {
  const selected: TimeTrialVisualFrameUnit[] = [];
  const safeGap = clamp(minimumProgressGap, 0, 1);

  for (const unit of units) {
    if (
      selected.every(
        (visibleUnit) =>
          Math.abs(visibleUnit.progress - unit.progress) >= safeGap,
      )
    ) {
      selected.push(unit);
    }
    if (selected.length >= limit) break;
  }

  return selected;
}

export function getTimeTrialSplitStandings({
  schedule,
  snapshot,
  raceElapsedSeconds,
  courseDistanceKm,
  limit = 20,
}: {
  schedule: readonly TimeTrialVisualUnit[];
  snapshot: RaceTimelineSnapshot;
  raceElapsedSeconds: number;
  courseDistanceKm: number;
  limit?: number;
}): TimeTrialSplitStanding[] {
  const groupByRiderId = new Map(
    snapshot.groups.flatMap((group) =>
      group.riderIds.map((riderId) => [riderId, group] as const),
    ),
  );
  const fastestFinishSeconds =
    schedule.length > 0
      ? Math.min(...schedule.map((unit) => unit.elapsedTimeSeconds))
      : 1;
  const projectedLeaderTime =
    fastestFinishSeconds *
    clamp(
      snapshot.completedDistanceKm / Math.max(1, courseDistanceKm),
      0,
      1,
    );
  const passed = schedule
    .flatMap((unit) => {
      const group = unit.riderIds
        .map((riderId) => groupByRiderId.get(riderId))
        .find((candidate) => candidate !== undefined);
      if (!group) return [];

      const elapsedTimeSeconds =
        group.elapsedTimeSeconds ??
        projectedLeaderTime + group.gapToLeaderSeconds;
      if (unit.startSeconds + elapsedTimeSeconds > raceElapsedSeconds) {
        return [];
      }

      return [{
        id: unit.id,
        label: unit.label,
        riderIds: unit.riderIds,
        elapsedTimeSeconds,
        gapToLeaderSeconds: 0,
        passageOrder: unit.startOrder,
      }];
    })
    .sort(
      (first, second) =>
        first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
        first.passageOrder - second.passageOrder,
    );
  const leaderTime = passed[0]?.elapsedTimeSeconds ?? 0;

  return passed.slice(0, Math.max(0, limit)).map((standing) => ({
    ...standing,
    gapToLeaderSeconds: Math.max(
      0,
      standing.elapsedTimeSeconds - leaderTime,
    ),
  }));
}

export function getTimeTrialSplitIndexes(segmentCount: number) {
  if (segmentCount <= 0) return [];
  if (segmentCount <= 3) {
    return Array.from({ length: segmentCount }, (_, index) => index);
  }
  return [
    Math.max(0, Math.round(segmentCount / 3) - 1),
    Math.max(0, Math.round((segmentCount * 2) / 3) - 1),
    segmentCount - 1,
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function buildIndividualStarters(
  riders: readonly RiderSimulationInput[],
  resultByRiderId: Map<string, StageSimulationResult["results"][number]>,
  gcRankByRiderId: Map<string, number>,
) {
  return riders
    .map((rider) => {
      const result = resultByRiderId.get(rider.id);
      return {
        id: rider.id,
        label: rider.name,
        riderIds: [rider.id],
        elapsedTimeSeconds: Math.max(1, result?.elapsedTimeSeconds ?? 1),
        gcRank: gcRankByRiderId.get(rider.id) ?? Number.MAX_SAFE_INTEGER,
        resultRank: result?.rank ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((first, second) => {
      if (gcRankByRiderId.size > 0) {
        return (
          second.gcRank - first.gcRank ||
          second.resultRank - first.resultRank ||
          first.label.localeCompare(second.label, "fr")
        );
      }
      return (
        second.resultRank - first.resultRank ||
        first.label.localeCompare(second.label, "fr")
      );
    })
    .map((starter) => ({
      id: starter.id,
      label: starter.label,
      riderIds: starter.riderIds,
      elapsedTimeSeconds: starter.elapsedTimeSeconds,
    }));
}

function buildTeamStarters(
  riders: readonly RiderSimulationInput[],
  resultByRiderId: Map<string, StageSimulationResult["results"][number]>,
  gcRankByRiderId: Map<string, number>,
) {
  const teams = new Map<string, RiderSimulationInput[]>();
  for (const rider of riders) {
    const teammates = teams.get(rider.teamId) ?? [];
    teammates.push(rider);
    teams.set(rider.teamId, teammates);
  }

  return [...teams.entries()]
    .map(([teamId, teammates]) => ({
      id: `team-${teamId}`,
      label: teammates[0]?.teamName ?? teamId,
      riderIds: teammates.map((rider) => rider.id),
      elapsedTimeSeconds: Math.max(
        1,
        resultByRiderId.get(teammates[0]?.id ?? "")?.elapsedTimeSeconds ?? 1,
      ),
      gcRank: Math.min(
        ...teammates.map(
          (rider) =>
            gcRankByRiderId.get(rider.id) ?? Number.MAX_SAFE_INTEGER,
        ),
      ),
    }))
    .sort(
      (first, second) =>
        second.gcRank - first.gcRank ||
        first.label.localeCompare(second.label, "fr"),
    )
    .map((starter) => ({
      id: starter.id,
      label: starter.label,
      riderIds: starter.riderIds,
      elapsedTimeSeconds: starter.elapsedTimeSeconds,
    }));
}

function getGeneralClassificationRankByRiderId(
  generalClassification: StageSimulationInput["generalClassification"],
) {
  return new Map(
    [...(generalClassification ?? [])]
      .sort(
        (first, second) =>
          first.elapsedTimeSeconds - second.elapsedTimeSeconds,
      )
      .map((row, index) => [row.riderId, index + 1] as const),
  );
}

function getRecordedCourseProgress(
  starter: TimeTrialVisualUnit,
  elapsedTimeSeconds: number,
  timeline: readonly RaceTimelineSnapshot[],
) {
  const totalDistanceKm = timeline.at(-1)?.completedDistanceKm ?? 0;
  if (totalDistanceKm <= 0) return null;

  let previousDistanceKm = 0;
  let previousElapsedTimeSeconds = 0;
  let hasRecordedSplit = false;

  for (const snapshot of timeline) {
    const group = snapshot.groups.find((candidate) =>
      starter.riderIds.some((riderId) =>
        candidate.riderIds.includes(riderId),
      ),
    );
    if (group?.elapsedTimeSeconds === undefined) continue;

    hasRecordedSplit = true;
    if (elapsedTimeSeconds <= group.elapsedTimeSeconds) {
      const splitDuration = Math.max(
        0.001,
        group.elapsedTimeSeconds - previousElapsedTimeSeconds,
      );
      const splitProgress = clamp(
        (elapsedTimeSeconds - previousElapsedTimeSeconds) / splitDuration,
        0,
        1,
      );
      const distanceKm =
        previousDistanceKm +
        (snapshot.completedDistanceKm - previousDistanceKm) * splitProgress;
      return clamp(distanceKm / totalDistanceKm, 0, 1);
    }

    previousDistanceKm = snapshot.completedDistanceKm;
    previousElapsedTimeSeconds = group.elapsedTimeSeconds;
  }

  return hasRecordedSplit ? 1 : null;
}


function getPacingBias(id: string) {
  const hash = [...id].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    23,
  );
  return ((hash % 281) - 140) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
