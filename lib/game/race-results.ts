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
  teamName: string;
  rank: number | null;
  status: OfficialResultStatus;
  elapsedTimeMs: number | null;
  gapToWinnerMs: number | null;
  mountainPoints: number;
  sprintPoints: number;
  abandonmentReason: string | null;
};

export type OfficialTeamResult = {
  teamId: string;
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
  teamName: string;
  status: OfficialResultStatus;
  elapsedTimeMs: number | null;
  abandonmentReason: string | null;
};

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
    Omit<PersistedStageResultForGeneral, "status" | "elapsedTimeMs" | "abandonmentReason">
  >();
  const totalTimeByRiderId = new Map<string, number>();
  const abandonedByRiderId = new Map<string, PersistedStageResultForGeneral>();

  for (const stage of stageResults) {
    for (const result of stage) {
      identityByRiderId.set(result.riderId, {
        riderId: result.riderId,
        riderName: result.riderName,
        teamId: result.teamId,
        teamName: result.teamName,
      });

      if (result.status === "finished" && result.elapsedTimeMs !== null) {
        totalTimeByRiderId.set(
          result.riderId,
          (totalTimeByRiderId.get(result.riderId) ?? 0) + result.elapsedTimeMs
        );
      } else if (result.status !== "finished") {
        abandonedByRiderId.set(result.riderId, result);
      }
    }
  }

  const classified = [...totalTimeByRiderId.entries()]
    .filter(([riderId]) => !abandonedByRiderId.has(riderId))
    .sort(
      (first, second) =>
        first[1] - second[1] || first[0].localeCompare(second[0])
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
