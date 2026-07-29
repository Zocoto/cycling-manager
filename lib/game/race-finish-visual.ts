import type {
  FinalBattleScenario,
  RiderSimulationInput,
} from "./race-simulation";

export const FINAL_KILOMETER_DURATION_MS = 8_000;

type SprintVisualRider = Pick<
  RiderSimulationInput,
  "id" | "teamId" | "role"
>;

type SprintVisualBattleRider = Pick<
  RiderSimulationInput,
  "id" | "name" | "teamId" | "role" | "ratings"
>;

type SprintVisualResult = {
  riderId: string;
  status: "finished" | "did_not_finish" | "outside_time_limit";
  rank: number | null;
  energyAfter: number;
};

export type SprintVisualBattle = {
  favoriteRiderIds: string[];
  wheelTargetByRiderId: Record<string, string>;
  dominantWinnerId: string | null;
};

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

export function buildSprintVisualBattle({
  riders,
  results,
  seed,
}: {
  riders: readonly SprintVisualBattleRider[];
  results: readonly SprintVisualResult[];
  seed: string | number;
}): SprintVisualBattle {
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const resultByRiderId = new Map(
    results.map((result) => [result.riderId, result])
  );
  const finishers = riders.filter(
    (rider) => resultByRiderId.get(rider.id)?.status === "finished"
  );
  const sprinters = finishers.filter(
    (rider) => rider.role === "sprinter"
  );
  const candidatePool = sprinters.length >= 3 ? sprinters : finishers;
  const orderedCandidates = [...candidatePool].sort(
    (first, second) =>
      getSprintVisualStrength(
        second,
        resultByRiderId.get(second.id)?.energyAfter ?? 0
      ) -
      getSprintVisualStrength(
        first,
        resultByRiderId.get(first.id)?.energyAfter ?? 0
      )
  );
  const favorites = orderedCandidates.slice(0, 5);
  const winnerResult = results.find(
    (result) => result.status === "finished" && result.rank === 1
  );
  const winner = winnerResult
    ? riderById.get(winnerResult.riderId)
    : undefined;

  if (winner && !favorites.some((favorite) => favorite.id === winner.id)) {
    favorites.splice(Math.min(4, favorites.length), 0, winner);
    favorites.splice(5);
  }

  const wheelTargetByRiderId: Record<string, string> = {};
  favorites.forEach((rider, index) => {
    if (index === 0) return;
    const riderStrength = getSprintVisualStrength(
      rider,
      resultByRiderId.get(rider.id)?.energyAfter ?? 0
    );
    const target = favorites
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.teamId !== rider.teamId &&
          getSprintVisualStrength(
            candidate,
            resultByRiderId.get(candidate.id)?.energyAfter ?? 0
          ) -
            riderStrength <=
            10
      );
    if (!target) return;

    const hasOwnLeadout = riders.some(
      (candidate) =>
        candidate.teamId === rider.teamId &&
        candidate.role === "leadout"
    );
    const borrowsWheel =
      !hasOwnLeadout ||
      getVisualHash(`${seed}:${rider.id}:wheel`) % 3 === 0;
    if (borrowsWheel) {
      wheelTargetByRiderId[rider.id] = target.id;
    }
  });

  let dominantWinnerId: string | null = null;
  if (winner) {
    const winnerStrength = getSprintVisualStrength(
      winner,
      winnerResult?.energyAfter ?? 0
    );
    const strongestOpponent = favorites
      .filter((favorite) => favorite.id !== winner.id)
      .reduce(
        (best, favorite) =>
          Math.max(
            best,
            getSprintVisualStrength(
              favorite,
              resultByRiderId.get(favorite.id)?.energyAfter ?? 0
            )
          ),
        Number.NEGATIVE_INFINITY
      );
    const strengthGap = winnerStrength - strongestOpponent;
    const exceptionalDay = getVisualHash(`${seed}:dominance`) % 5 === 0;
    if (strengthGap >= 5 || (strengthGap >= 2 && exceptionalDay)) {
      dominantWinnerId = winner.id;
    }
  }

  return {
    favoriteRiderIds: favorites.map((favorite) => favorite.id),
    wheelTargetByRiderId,
    dominantWinnerId,
  };
}

function getSprintVisualStrength(
  rider: SprintVisualBattleRider,
  energyAfter: number
) {
  return (
    rider.ratings.sprint * 0.68 +
    rider.ratings.acceleration * 0.2 +
    rider.ratings.resistance * 0.04 +
    energyAfter * 0.08 +
    (rider.role === "sprinter" ? 3 : 0)
  );
}

function getVisualHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    7
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

export function shouldWinnerCelebrate({
  metersRemaining,
  isPhotoFinish,
}: {
  metersRemaining: number;
  isPhotoFinish: boolean;
}) {
  return !isPhotoFinish && metersRemaining <= 35;
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
