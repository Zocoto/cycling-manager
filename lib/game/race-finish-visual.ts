import type {
  FinalBattleScenario,
  RiderSimulationInput,
} from "./race-simulation";

export const FINAL_KILOMETER_DURATION_MS = 8_000;
export const FINAL_FINISH_PASSAGE_DURATION_MS = 5_000;
export const FINISH_LINE_REVEAL_METERS = 500;

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

export type SprintVisualRosterTeam = {
  teamId: string;
  contenderRiderId: string;
  leadoutRiderIds: string[];
  riderIds: string[];
};

export type MassSprintVisualPhase =
  | "trains"
  | "selection"
  | "leadout-release"
  | "duel"
  | "passage";

export type MassSprintVisualFrame = {
  phase: MassSprintVisualPhase;
  position: number;
  opacity: number;
  verticalOffset: number;
};

export function buildSprintVisualRoster({
  riders,
  favoriteRiderIds,
  maximumTeams = 10,
}: {
  riders: readonly SprintVisualRider[];
  favoriteRiderIds: readonly string[];
  maximumTeams?: number;
}): SprintVisualRosterTeam[] {
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const selectedTeamIds = new Set<string>();
  const roster: SprintVisualRosterTeam[] = [];

  for (const contenderRiderId of favoriteRiderIds) {
    const contender = riderById.get(contenderRiderId);
    if (!contender || selectedTeamIds.has(contender.teamId)) continue;

    const leadoutRiderIds = riders
      .filter(
        (rider) =>
          rider.teamId === contender.teamId &&
          rider.role === "leadout" &&
          rider.id !== contenderRiderId
      )
      .slice(0, 2)
      .map((rider) => rider.id);

    roster.push({
      teamId: contender.teamId,
      contenderRiderId,
      leadoutRiderIds,
      riderIds: [...leadoutRiderIds, contenderRiderId],
    });
    selectedTeamIds.add(contender.teamId);
    if (roster.length >= maximumTeams) break;
  }

  return roster;
}

export function getMassSprintVisualPhase(
  metersRemaining: number
): { phase: MassSprintVisualPhase; progress: number } {
  if (metersRemaining > 2_000) {
    return {
      phase: "trains",
      progress: clamp((5_000 - metersRemaining) / 3_000, 0, 1),
    };
  }
  if (metersRemaining > 700) {
    return {
      phase: "selection",
      progress: clamp((2_000 - metersRemaining) / 1_300, 0, 1),
    };
  }
  if (metersRemaining > 250) {
    return {
      phase: "leadout-release",
      progress: clamp((700 - metersRemaining) / 450, 0, 1),
    };
  }
  if (metersRemaining > 0) {
    return {
      phase: "duel",
      progress: clamp((250 - metersRemaining) / 250, 0, 1),
    };
  }
  return { phase: "passage", progress: 1 };
}

export function getMassSprintFinishPosition({
  contenderIndex,
  gapToWinnerSeconds,
  finishLinePosition,
}: {
  contenderIndex: number;
  gapToWinnerSeconds: number;
  finishLinePosition: number;
}) {
  if (contenderIndex <= 0) return finishLinePosition;

  const tireToBikeSpacing = Math.min(
    4.8,
    0.75 + contenderIndex * 0.95
  );
  const officialGapSpacing = Math.min(
    12,
    Math.max(0, gapToWinnerSeconds) * 0.9
  );

  return finishLinePosition - tireToBikeSpacing - officialGapSpacing;
}

export function getMassSprintVisualFrame({
  metersRemaining,
  teamIndex,
  teamCount,
  memberIndex,
  memberCount,
  contenderIndex,
  contenderCount,
  isLeadout,
  isDominantWinner,
  finalTargetPosition,
  visualSeed,
}: {
  metersRemaining: number;
  teamIndex: number;
  teamCount: number;
  memberIndex: number;
  memberCount: number;
  contenderIndex: number;
  contenderCount: number;
  isLeadout: boolean;
  isDominantWinner: boolean;
  finalTargetPosition: number;
  visualSeed: number;
}): MassSprintVisualFrame {
  const { phase, progress } = getMassSprintVisualPhase(metersRemaining);
  const centeredTeamIndex = (Math.max(1, teamCount) - 1) / 2 - teamIndex;
  const teamBias = centeredTeamIndex * 0.72;
  const formationOffset = Math.max(0, memberCount - memberIndex - 1) * 3.4;
  const favoriteBias = contenderIndex >= 0
    ? ((Math.max(1, contenderCount) - 1) / 2 - contenderIndex) * 0.55
    : 0;
  const verticalOffset =
    (memberIndex - (Math.max(1, memberCount) - 1) / 2) * 0.65;

  if (phase === "trains") {
    return {
      phase,
      position: 31 + progress * 8 + teamBias + formationOffset,
      opacity: 1,
      verticalOffset,
    };
  }

  if (phase === "selection") {
    return {
      phase,
      position:
        39 +
        progress * 13 +
        teamBias * (1 - progress * 0.45) +
        favoriteBias * progress +
        formationOffset * (1 - progress * 0.25),
      opacity: 1,
      verticalOffset,
    };
  }

  if (phase === "leadout-release") {
    if (isLeadout) {
      return {
        phase,
        position: 58 + formationOffset * 0.45 - progress * 9 + teamBias * 0.3,
        opacity: clamp(1 - progress * 0.72, 0.28, 1),
        verticalOffset: verticalOffset + progress * 3.2,
      };
    }
    return {
      phase,
      position: 53 + progress * 10 + favoriteBias * (0.5 + progress * 0.5),
      opacity: 1,
      verticalOffset,
    };
  }

  if (phase === "duel" && !isLeadout) {
    const seedPhase = ((Math.abs(visualSeed) + Math.max(0, contenderIndex) * 17) % 19) / 19;
    const suspense =
      Math.sin((progress * 2.15 + seedPhase) * Math.PI * 2) *
      Math.sin(progress * Math.PI) *
      1.45;
    const dominance = isDominantWinner
      ? Math.sin(progress * Math.PI) * 1.8
      : 0;
    return {
      phase,
      position:
        63 * (1 - progress) +
        finalTargetPosition * progress +
        suspense +
        dominance,
      opacity: 1,
      verticalOffset,
    };
  }

  if (isLeadout) {
    return {
      phase,
      position: 49 - progress * 4 + teamBias * 0.2,
      opacity: phase === "passage" ? 0 : clamp(0.28 - progress * 0.3, 0, 0.28),
      verticalOffset: verticalOffset + 3.2,
    };
  }

  return {
    phase,
    position: finalTargetPosition,
    opacity: 1,
    verticalOffset,
  };
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
  const favorites = orderedCandidates.slice(0, 10);
  const winnerResult = results.find(
    (result) => result.status === "finished" && result.rank === 1
  );
  const winner = winnerResult
    ? riderById.get(winnerResult.riderId)
    : undefined;

  if (winner && !favorites.some((favorite) => favorite.id === winner.id)) {
    favorites.splice(Math.min(9, favorites.length), 0, winner);
    favorites.splice(10);
  }

  const wheelTargetByRiderId: Record<string, string> = {};
  favorites.forEach((rider, index) => {
    const hasOwnLeadout = riders.some(
      (candidate) =>
        candidate.teamId === rider.teamId &&
        candidate.role === "leadout"
    );
    if (hasOwnLeadout) return;

    const riderStrength = getSprintVisualStrength(
      rider,
      resultByRiderId.get(rider.id)?.energyAfter ?? 0
    );
    const hasLeadout = (candidate: SprintVisualBattleRider) =>
      riders.some(
        (teamMate) =>
          teamMate.teamId === candidate.teamId &&
          teamMate.role === "leadout"
      );
    const previousCandidates = favorites
      .slice(0, index)
      .filter((candidate) => candidate.teamId !== rider.teamId);
    const targetPool = [
      ...previousCandidates.filter(hasLeadout),
      ...favorites.filter(
        (candidate) =>
          candidate.id !== rider.id &&
          candidate.teamId !== rider.teamId &&
          hasLeadout(candidate)
      ),
      ...previousCandidates,
    ];
    const target = [...new Map(
      targetPool.map((candidate) => [candidate.id, candidate])
    ).values()].sort(
      (first, second) =>
        Math.abs(
          getSprintVisualStrength(
            first,
            resultByRiderId.get(first.id)?.energyAfter ?? 0
          ) - riderStrength
        ) -
        Math.abs(
          getSprintVisualStrength(
            second,
            resultByRiderId.get(second.id)?.energyAfter ?? 0
          ) - riderStrength
        )
    )[0];

    if (target) {
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
  void battleProgress;
  return scenario.contenderIds;
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

export function getFinalReplayFrame({
  startedWithMeters,
  startedWithPassageProgress = 0,
  finalSegmentMeters,
  elapsedMs,
  playbackSpeed,
  approachDurationMs,
  finishPassageDurationMs = FINAL_FINISH_PASSAGE_DURATION_MS,
}: {
  startedWithMeters: number;
  startedWithPassageProgress?: number;
  finalSegmentMeters: number;
  elapsedMs: number;
  playbackSpeed: number;
  approachDurationMs: number;
  finishPassageDurationMs?: number;
}) {
  const metersRemaining = getFinalReplayMeters({
    startedWithMeters,
    finalSegmentMeters,
    elapsedMs,
    playbackSpeed,
    approachDurationMs,
  });
  const winnerPassageDurationMs = getFinalReplayWinnerDurationMs({
    startedWithMeters,
    finalSegmentMeters,
    playbackSpeed,
    approachDurationMs,
  });
  const finishPassageProgress = metersRemaining > 0
    ? 0
    : clamp(
        startedWithPassageProgress +
          Math.max(0, elapsedMs - winnerPassageDurationMs) /
            (finishPassageDurationMs / Math.max(0.1, playbackSpeed)),
        0,
        1
      );

  return {
    metersRemaining,
    finishPassageProgress,
    complete: metersRemaining <= 0 && finishPassageProgress >= 1,
  };
}

function getFinalReplayWinnerDurationMs({
  startedWithMeters,
  finalSegmentMeters,
  playbackSpeed,
  approachDurationMs,
}: {
  startedWithMeters: number;
  finalSegmentMeters: number;
  playbackSpeed: number;
  approachDurationMs: number;
}) {
  const speed = Math.max(0.1, playbackSpeed);
  const lastKilometerStart = Math.min(1_000, startedWithMeters);
  const approachDistance = Math.max(0, startedWithMeters - lastKilometerStart);
  const fullApproachDistance = Math.max(1, finalSegmentMeters - 1_000);
  const currentApproachDurationMs =
    (approachDurationMs * approachDistance) / fullApproachDistance / speed;
  const lastKilometerDurationMs =
    (FINAL_KILOMETER_DURATION_MS * lastKilometerStart) / 1_000 / speed;

  return currentApproachDurationMs + lastKilometerDurationMs;
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
  return !isPhotoFinish && metersRemaining <= 180;
}

export function getFinishPassageDurationMs(
  maximumGapToWinnerSeconds: number
) {
  return Math.max(
    FINAL_FINISH_PASSAGE_DURATION_MS,
    (Math.max(0, maximumGapToWinnerSeconds) + 1) * 1_000
  );
}

export function getFinalApproachDisplayPosition({
  desiredPosition,
  metersRemaining,
  finishLinePosition,
  rank,
}: {
  desiredPosition: number;
  metersRemaining: number;
  finishLinePosition: number;
  rank: number;
}) {
  if (metersRemaining <= 0) {
    return rank <= 1
      ? finishLinePosition
      : Math.min(desiredPosition, finishLinePosition);
  }

  const approachProgress = clamp(
    (FINISH_LINE_REVEAL_METERS - metersRemaining) /
      FINISH_LINE_REVEAL_METERS,
    0,
    1
  );
  const smoothApproachProgress =
    approachProgress *
    approachProgress *
    (3 - 2 * approachProgress);
  const approachStartPosition = finishLinePosition - 24;
  const distanceSynchronizedLimit =
    approachStartPosition +
    (finishLinePosition - approachStartPosition) *
      smoothApproachProgress;

  return Math.min(
    desiredPosition,
    distanceSynchronizedLimit,
    finishLinePosition - 0.35
  );
}

export function getFinalGroupEntryPosition({
  groupGapSeconds,
  riderIndex,
  groupSize,
}: {
  groupGapSeconds: number;
  riderIndex: number;
  groupSize: number;
}) {
  const groupFront = 62 - Math.min(48, Math.max(0, groupGapSeconds) * 0.45);
  const groupSpan = Math.min(8, Math.max(0, groupSize - 1) * 1.6);
  const riderOffset = groupSize <= 1
    ? 0
    : (Math.max(0, riderIndex) / (groupSize - 1)) * groupSpan;

  return clamp(groupFront - riderOffset, 9, 82);
}

export function getFinalApproachPosition({
  rank,
  gapToWinnerSeconds,
  finishLinePosition,
}: {
  rank: number;
  gapToWinnerSeconds: number;
  finishLinePosition: number;
}) {
  if (rank <= 1) return finishLinePosition;

  const officialGapSpacing = Math.min(
    58,
    Math.max(0, gapToWinnerSeconds) * 0.42
  );
  const sameTimeRankSpacing = gapToWinnerSeconds <= 0
    ? Math.min(12, (rank - 1) * 1.2)
    : Math.min(10, (rank - 1) * 0.35);

  return clamp(
    finishLinePosition - 1.6 - officialGapSpacing - sameTimeRankSpacing,
    8,
    finishLinePosition - 1
  );
}

/**
 * Répartit un groupe de côté sur plusieurs profondeurs de route. Les écarts
 * sportifs restent portés par l’axe horizontal tandis que cette légère
 * alternance empêche les silhouettes de se masquer entre elles.
 */
export function getFinishLaneOffset({
  riderIndex,
  roadDepth,
}: {
  riderIndex: number;
  roadDepth: number;
}) {
  const laneRatios = [0, -0.18, 0.18, -0.3, 0.3, -0.1, 0.1] as const;
  return roadDepth * laneRatios[Math.abs(riderIndex) % laneRatios.length];
}

export function getFinishPassagePosition({
  approachPosition,
  rank,
  riderCount,
  gapToWinnerSeconds,
  maximumGapToWinnerSeconds,
  finishPassageProgress,
  finishLinePosition,
  winnerHasFinished,
}: {
  approachPosition: number;
  rank: number;
  riderCount: number;
  gapToWinnerSeconds: number;
  maximumGapToWinnerSeconds: number;
  finishPassageProgress: number;
  finishLinePosition: number;
  winnerHasFinished: boolean;
}) {
  if (!winnerHasFinished) return approachPosition;
  const passageDurationSeconds =
    getFinishPassageDurationMs(maximumGapToWinnerSeconds) / 1_000;
  const elapsedSeconds =
    clamp(finishPassageProgress, 0, 1) * passageDurationSeconds;
  const visualOrderOffsetSeconds =
    rank <= 1
      ? 0
      : Math.min(0.35, Math.max(0, rank - 1) * 0.025);
  const crossingTimeSeconds =
    Math.max(0, gapToWinnerSeconds) + visualOrderOffsetSeconds;
  const crossingAnimationSeconds = 0.45;
  const approachToLineProgress = crossingTimeSeconds <= 0
    ? 1
    : clamp(elapsedSeconds / crossingTimeSeconds, 0, 1);
  const afterLineProgress = clamp(
    (elapsedSeconds - crossingTimeSeconds) / crossingAnimationSeconds,
    0,
    1
  );
  const afterLinePosition =
    finishLinePosition +
    3.5 +
    Math.min(2.5, Math.max(0, riderCount - rank) * 0.18);
  const positionAtLine =
    approachPosition * (1 - approachToLineProgress) +
    finishLinePosition * approachToLineProgress;

  return clamp(
    positionAtLine * (1 - afterLineProgress) +
      afterLinePosition * afterLineProgress,
    8,
    92
  );
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
  entryPositionOverride?: number;
  finishPositionOverride?: number;
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
  entryPositionOverride,
  finishPositionOverride,
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
  const readableEntryPosition = entryPositionOverride ??
    Math.max(9, entryPosition - lateJoinerPenalty);

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
  const finishPosition = finishPositionOverride ??
    (decisiveIndex >= 0
      ? leaderTarget - decisiveIndex * decisiveSpacing
      : droppedStart - Math.max(0, droppedIndex) * droppedSpacing);
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


function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
