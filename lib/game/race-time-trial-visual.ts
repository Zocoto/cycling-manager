import type {
  RiderSimulationInput,
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

  if (starterCount <= 20) return 120;
  if (starterCount <= 50) return 90;
  if (starterCount <= 100) return 60;
  return 45;
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

    active.push({
      ...starter,
      rawProgress,
      progress: clamp(
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
