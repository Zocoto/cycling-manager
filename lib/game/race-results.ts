export type OfficialResultStatus =
  | "finished"
  | "did_not_start"
  | "did_not_finish"
  | "disqualified"
  | "outside_time_limit"
  | "withdrawn";

export type OfficialRiderResult = {
  riderId: string;
  riderName: string;
  teamId: string;
  teamProfileId?: string | null;
  teamName: string;
  rank: number | null;
  status: OfficialResultStatus;
  elapsedTimeMs: number | null;
  gapToWinnerMs: number | null;
  mountainPoints: number;
  sprintPoints: number;
  timeBonusSeconds?: number;
  timePenaltySeconds?: number;
  abandonmentReason: string | null;
};

export type OfficialTeamResult = {
  teamId: string;
  teamProfileId?: string | null;
  teamName: string;
  rank: number;
  totalTimeMs: number;
};

export type OfficialSecondaryClassification = {
  type: "mountain" | "sprint" | "youth" | "team";
  riders: OfficialRiderResult[];
  teams: OfficialTeamResult[];
};

export type OfficialStageClassification = {
  stageId: string;
  stageNumber: number;
  stageName: string;
  results: OfficialRiderResult[];
};

export type OfficialAttackParticipant = {
  riderId: string;
  riderName: string;
  teamId: string;
  teamProfileId?: string | null;
  teamName: string;
  participationType: "breakaway" | "chase";
  stageNumbers: number[];
};

export type OfficialRaceEditionResults = {
  editionId: string;
  isComplete: boolean;
  stages: OfficialStageClassification[];
  general: OfficialRiderResult[];
  generalIsProvisional: boolean;
  secondary: OfficialSecondaryClassification[];
  attackParticipants: OfficialAttackParticipant[];
};

export type OfficialRaceResultsDirectory = Record<
  string,
  OfficialRaceEditionResults
>;

export type PersistedStageResultForGeneral = {
  riderId: string;
  riderName: string;
  teamId: string;
  teamProfileId?: string | null;
  teamName: string;
  rank: number | null;
  status: OfficialResultStatus;
  elapsedTimeMs: number | null;
  timeBonusSeconds?: number;
  timePenaltySeconds?: number;
  abandonmentReason: string | null;
};

export type PersistedStageRaceStandings = {
  mountain: Array<{ riderId: string; points: number }>;
  sprint: Array<{ riderId: string; points: number }>;
  youth: Array<{ riderId: string; elapsedTimeSeconds: number }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    elapsedTimeSeconds: number;
  }>;
};

export function shouldSettleRaceEdition(
  edition: { id: string; status?: string },
  repairableCompletedEditionIds: ReadonlySet<string>,
  hasPendingStage = false,
) {
  if (edition.status === "cancelled") return false;
  if (edition.status === "completed" && hasPendingStage) return true;
  if (edition.status !== "completed") return true;

  return repairableCompletedEditionIds.has(edition.id);
}

export function normalizeOfficialResultGapsToLeader(
  results: OfficialRiderResult[]
): OfficialRiderResult[] {
  const leader = results.find(
    (result) =>
      result.status === "finished" &&
      result.rank === 1 &&
      result.elapsedTimeMs !== null
  );

  if (!leader || leader.elapsedTimeMs === null) return results;
  const leaderTime = leader.elapsedTimeMs;

  return results.map((result) =>
    result.status === "finished" && result.elapsedTimeMs !== null
      ? {
          ...result,
          gapToWinnerMs: Math.max(0, result.elapsedTimeMs - leaderTime),
        }
      : result
  );
}

export function buildPersistedGeneralClassification(
  stageResults: PersistedStageResultForGeneral[][]
): OfficialRiderResult[] {
  const identityByRiderId = new Map<
    string,
    Omit<
      PersistedStageResultForGeneral,
      | "rank"
      | "status"
      | "elapsedTimeMs"
      | "timeBonusSeconds"
      | "timePenaltySeconds"
      | "abandonmentReason"
    >
  >();
  const totalTimeByRiderId = new Map<string, number>();
  const rankSumByRiderId = new Map<string, number>();
  const lastStageRankByRiderId = new Map<string, number>();
  const finishedStagesByRiderId = new Map<string, number>();
  const abandonedByRiderId = new Map<string, PersistedStageResultForGeneral>();

  for (const stage of stageResults) {
    for (const result of stage) {
      identityByRiderId.set(result.riderId, {
        riderId: result.riderId,
        riderName: result.riderName,
        teamId: result.teamId,
        teamProfileId: result.teamProfileId,
        teamName: result.teamName,
      });

      if (result.status === "finished" && result.elapsedTimeMs !== null) {
        const adjustedElapsedTimeMs = Math.max(
          1,
          result.elapsedTimeMs -
            (result.timeBonusSeconds ?? 0) * 1_000 +
            (result.timePenaltySeconds ?? 0) * 1_000,
        );
        totalTimeByRiderId.set(
          result.riderId,
          (totalTimeByRiderId.get(result.riderId) ?? 0) + adjustedElapsedTimeMs
        );
        finishedStagesByRiderId.set(
          result.riderId,
          (finishedStagesByRiderId.get(result.riderId) ?? 0) + 1
        );
        if (result.rank !== null) {
          rankSumByRiderId.set(
            result.riderId,
            (rankSumByRiderId.get(result.riderId) ?? 0) + result.rank
          );
          lastStageRankByRiderId.set(result.riderId, result.rank);
        }
      } else if (result.status !== "finished") {
        abandonedByRiderId.set(result.riderId, result);
      }
    }
  }

  // Un coureur blessé peut terminer une étape puis ne pas repartir le
  // lendemain : il n'apparaît plus dans les étapes suivantes. Sans résultat
  // « finished » sur chaque étape, il ne peut pas figurer au classement
  // général chronométré.
  const stageCount = stageResults.length;
  for (const [riderId, finishedStages] of finishedStagesByRiderId) {
    if (finishedStages === stageCount || abandonedByRiderId.has(riderId)) {
      continue;
    }
    const identity = identityByRiderId.get(riderId)!;
    abandonedByRiderId.set(riderId, {
      ...identity,
      status: "did_not_start",
      rank: null,
      elapsedTimeMs: null,
      abandonmentReason: null,
    });
  }

  const classified = [...totalTimeByRiderId.entries()]
    .filter(([riderId]) => !abandonedByRiderId.has(riderId))
    .sort(
      (first, second) =>
        first[1] - second[1] ||
        (rankSumByRiderId.get(first[0]) ?? Number.MAX_SAFE_INTEGER) -
          (rankSumByRiderId.get(second[0]) ?? Number.MAX_SAFE_INTEGER) ||
        (lastStageRankByRiderId.get(first[0]) ?? Number.MAX_SAFE_INTEGER) -
          (lastStageRankByRiderId.get(second[0]) ??
            Number.MAX_SAFE_INTEGER) ||
        first[0].localeCompare(second[0])
    );
  const winnerTime = classified[0]?.[1] ?? 0;
  const general = classified.map(([riderId, elapsedTimeMs], index) => {
    const identity = identityByRiderId.get(riderId)!;
    return {
      ...identity,
      rank: index + 1,
      status: "finished" as const,
      elapsedTimeMs,
      gapToWinnerMs: Math.max(0, elapsedTimeMs - winnerTime),
      mountainPoints: 0,
      sprintPoints: 0,
      abandonmentReason: null,
    };
  });

  const abandonments = [...abandonedByRiderId.values()]
    .sort((first, second) =>
      first.riderName.localeCompare(second.riderName, "fr")
    )
    .map((result) => ({
      riderId: result.riderId,
      riderName: result.riderName,
      teamId: result.teamId,
      teamProfileId: result.teamProfileId,
      teamName: result.teamName,
      rank: null,
      status: result.status,
      elapsedTimeMs: null,
      gapToWinnerMs: null,
      mountainPoints: 0,
      sprintPoints: 0,
      abandonmentReason: result.abandonmentReason,
    }));

  return [...general, ...abandonments];
}

export function buildPersistedStageRaceStandings(
  stageResults: OfficialRiderResult[][],
  riderAgeById: ReadonlyMap<string, number>
): PersistedStageRaceStandings {
  const riderTimes = new Map<string, number>();
  const mountainPoints = new Map<string, number>();
  const sprintPoints = new Map<string, number>();
  const abandonedRiderIds = new Set<string>();
  const teamTimes = new Map<string, number>();
  const teamNameById = new Map<string, string>();

  for (const stage of stageResults) {
    const ridersByTeam = new Map<string, OfficialRiderResult[]>();
    const finisherTimes = stage.flatMap((result) =>
      result.status === "finished" && result.elapsedTimeMs !== null
        ? [result.elapsedTimeMs]
        : []
    );
    const nonFinisherTime = Math.max(0, ...finisherTimes) + 5 * 60_000;

    for (const result of stage) {
      const teamRiders = ridersByTeam.get(result.teamId) ?? [];
      teamRiders.push(result);
      ridersByTeam.set(result.teamId, teamRiders);
      teamNameById.set(result.teamId, result.teamName);

      if (result.status === "finished" && result.elapsedTimeMs !== null) {
        riderTimes.set(
          result.riderId,
          (riderTimes.get(result.riderId) ?? 0) + result.elapsedTimeMs
        );
        if (result.mountainPoints > 0) {
          mountainPoints.set(
            result.riderId,
            (mountainPoints.get(result.riderId) ?? 0) + result.mountainPoints
          );
        }
        if (result.sprintPoints > 0) {
          sprintPoints.set(
            result.riderId,
            (sprintPoints.get(result.riderId) ?? 0) + result.sprintPoints
          );
        }
      } else {
        abandonedRiderIds.add(result.riderId);
      }
    }

    for (const [teamId, riders] of ridersByTeam) {
      if (riders.length === 0) continue;
      const stageTeamTime =
        riders.reduce(
          (total, rider) =>
            total +
            (rider.status === "finished" && rider.elapsedTimeMs !== null
              ? rider.elapsedTimeMs
              : nonFinisherTime),
          0
        ) / riders.length;
      teamTimes.set(teamId, (teamTimes.get(teamId) ?? 0) + stageTeamTime);
    }
  }

  const activeRider = ([riderId]: [string, number]) =>
    !abandonedRiderIds.has(riderId);
  const byPoints = (first: [string, number], second: [string, number]) =>
    second[1] - first[1] || first[0].localeCompare(second[0]);
  const generalClassification = buildPersistedGeneralClassification(stageResults);

  return {
    mountain: [...mountainPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    sprint: [...sprintPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    youth: generalClassification
      .filter(
        (result) =>
          result.status === "finished" &&
          result.elapsedTimeMs !== null &&
          (riderAgeById.get(result.riderId) ?? 99) < 25,
      )
      .map((result) => ({
        riderId: result.riderId,
        elapsedTimeSeconds: Math.round((result.elapsedTimeMs ?? 0) / 1_000),
      })),
    teams: [...teamTimes.entries()]
      .sort(
        (first, second) =>
          first[1] - second[1] || first[0].localeCompare(second[0])
      )
      .map(([teamId, elapsedTimeMs]) => ({
        teamId,
        teamName: teamNameById.get(teamId) ?? teamId,
        elapsedTimeSeconds: Math.round(elapsedTimeMs / 1_000),
      })),
  };
}
