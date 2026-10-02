import type { StageSimulationResult } from "@/lib/game/race-simulation";

export type CombativityBreakdown = {
  distanceAtFrontKm: number;
  activeRelayDistanceKm: number;
  chaseDistanceKm: number;
  attacks: number;
  maxAdvantageSeconds: number;
  mountainPoints: number;
  sprintPoints: number;
  finishedStages: number;
};

export type CombativityRankingEntry = {
  riderId: string;
  score: number;
  breakdown: CombativityBreakdown;
};

type CombativityAccumulator = CombativityBreakdown & {
  riderId: string;
  finishRank: number | null;
};

const EMPTY_BREAKDOWN: CombativityBreakdown = {
  distanceAtFrontKm: 0,
  activeRelayDistanceKm: 0,
  chaseDistanceKm: 0,
  attacks: 0,
  maxAdvantageSeconds: 0,
  mountainPoints: 0,
  sprintPoints: 0,
  finishedStages: 0,
};

function roundDistance(value: number) {
  return Math.round(value * 10) / 10;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreBreakdown(breakdown: CombativityBreakdown) {
  return roundScore(
    breakdown.distanceAtFrontKm * 1.4 +
      breakdown.activeRelayDistanceKm * 2.1 +
      breakdown.chaseDistanceKm * 0.45 +
      breakdown.attacks * 9 +
      Math.min(35, breakdown.maxAdvantageSeconds / 18) +
      breakdown.mountainPoints * 1.15 +
      breakdown.sprintPoints * 0.8 +
      breakdown.finishedStages * 2,
  );
}

function compareRanking(
  left: CombativityRankingEntry & { finishRank?: number | null },
  right: CombativityRankingEntry & { finishRank?: number | null },
) {
  return (
    right.score - left.score ||
    right.breakdown.activeRelayDistanceKm -
      left.breakdown.activeRelayDistanceKm ||
    right.breakdown.distanceAtFrontKm - left.breakdown.distanceAtFrontKm ||
    right.breakdown.attacks - left.breakdown.attacks ||
    (left.finishRank ?? Number.MAX_SAFE_INTEGER) -
      (right.finishRank ?? Number.MAX_SAFE_INTEGER) ||
    left.riderId.localeCompare(right.riderId)
  );
}

/**
 * Mesure la combativité à partir des faits de course officiels. La place à
 * l'arrivée ne donne aucun bonus direct : le prix récompense d'abord le temps
 * passé devant et les relais réellement assumés.
 */
export function calculateStageCombativityRanking(
  simulation: StageSimulationResult,
): CombativityRankingEntry[] {
  const frames =
    simulation.visualTimeline && simulation.visualTimeline.length > 0
      ? simulation.visualTimeline
      : simulation.timeline;
  if (frames.length === 0) return [];

  const byRiderId = new Map<string, CombativityAccumulator>();
  const previousFrontRiderIds = new Set<string>();
  const finishByRiderId = new Map(
    simulation.results.map((result) => [result.riderId, result]),
  );

  const getAccumulator = (riderId: string) => {
    const existing = byRiderId.get(riderId);
    if (existing) return existing;
    const result = finishByRiderId.get(riderId);
    const created: CombativityAccumulator = {
      riderId,
      ...EMPTY_BREAKDOWN,
      finishedStages: result?.status === "finished" ? 1 : 0,
      finishRank: result?.rank ?? null,
    };
    byRiderId.set(riderId, created);
    return created;
  };

  let previousDistanceKm = 0;
  for (const frame of [...frames].sort(
    (left, right) =>
      left.completedDistanceKm - right.completedDistanceKm ||
      left.segmentNumber - right.segmentNumber,
  )) {
    const distanceDeltaKm = Math.max(
      0,
      frame.completedDistanceKm - previousDistanceKm,
    );
    previousDistanceKm = Math.max(previousDistanceKm, frame.completedDistanceKm);

    const raceGroups = frame.groups.filter(
      (group) => group.type !== "time_trial" && group.riderIds.length > 0,
    );
    const leadingGapSeconds =
      raceGroups.length > 0
        ? Math.min(...raceGroups.map((group) => group.gapToLeaderSeconds))
        : 0;
    const frontBreakawayGroups = raceGroups.filter(
      (group) =>
        group.type === "breakaway" &&
        group.gapToLeaderSeconds <= leadingGapSeconds + 0.5,
    );
    const frontRiderIds = new Set(
      frontBreakawayGroups.flatMap((group) => group.riderIds),
    );
    const chaseRiderIds = new Set(
      raceGroups
        .filter(
          (group) =>
            group.type === "chase" ||
            (group.type === "breakaway" &&
              group.gapToLeaderSeconds > leadingGapSeconds + 0.5),
        )
        .flatMap((group) => group.riderIds),
    );
    const pelotonGapSeconds = raceGroups
      .filter((group) => group.type === "peloton")
      .reduce(
        (maximum, group) => Math.max(maximum, group.gapToLeaderSeconds),
        0,
      );

    for (const riderId of frontRiderIds) {
      const accumulator = getAccumulator(riderId);
      accumulator.distanceAtFrontKm += distanceDeltaKm;
      accumulator.maxAdvantageSeconds = Math.max(
        accumulator.maxAdvantageSeconds,
        Math.max(0, pelotonGapSeconds - leadingGapSeconds),
      );
      if (!previousFrontRiderIds.has(riderId)) accumulator.attacks += 1;
    }
    for (const riderId of chaseRiderIds) {
      getAccumulator(riderId).chaseDistanceKm += distanceDeltaKm;
    }
    const activeRelayRiderIds =
      "frontDynamics" in frame
        ? (frame.frontDynamics?.activeRelayRiderIds ?? [])
        : [];
    for (const riderId of activeRelayRiderIds) {
      if (!frontRiderIds.has(riderId)) continue;
      getAccumulator(riderId).activeRelayDistanceKm += distanceDeltaKm;
    }

    previousFrontRiderIds.clear();
    for (const riderId of frontRiderIds) previousFrontRiderIds.add(riderId);
  }

  for (const [riderId, points] of Object.entries(simulation.mountainPoints)) {
    if (points <= 0) continue;
    getAccumulator(riderId).mountainPoints += points;
  }
  for (const [riderId, points] of Object.entries(simulation.sprintPoints)) {
    if (points <= 0) continue;
    getAccumulator(riderId).sprintPoints += points;
  }

  return [...byRiderId.values()]
    .filter(
      (entry) =>
        entry.distanceAtFrontKm >= 1 ||
        entry.activeRelayDistanceKm >= 0.5 ||
        entry.chaseDistanceKm >= 5 ||
        entry.attacks > 0,
    )
    .map((entry) => ({
      riderId: entry.riderId,
      score: scoreBreakdown(entry),
      finishRank: entry.finishRank,
      breakdown: {
        distanceAtFrontKm: roundDistance(entry.distanceAtFrontKm),
        activeRelayDistanceKm: roundDistance(entry.activeRelayDistanceKm),
        chaseDistanceKm: roundDistance(entry.chaseDistanceKm),
        attacks: entry.attacks,
        maxAdvantageSeconds: Math.round(entry.maxAdvantageSeconds),
        mountainPoints: entry.mountainPoints,
        sprintPoints: entry.sprintPoints,
        finishedStages: entry.finishedStages,
      },
    }))
    .sort(compareRanking)
    .map((entry) => ({
      riderId: entry.riderId,
      score: entry.score,
      breakdown: entry.breakdown,
    }));
}

export function calculateTourCombativityRanking({
  simulations,
  eligibleRiderIds,
}: {
  simulations: readonly StageSimulationResult[];
  eligibleRiderIds?: ReadonlySet<string>;
}): CombativityRankingEntry[] {
  const aggregateByRiderId = new Map<string, CombativityBreakdown>();

  for (const simulation of simulations) {
    for (const entry of calculateStageCombativityRanking(simulation)) {
      if (eligibleRiderIds && !eligibleRiderIds.has(entry.riderId)) continue;
      const aggregate = aggregateByRiderId.get(entry.riderId) ?? {
        ...EMPTY_BREAKDOWN,
      };
      for (const key of Object.keys(aggregate) as Array<
        keyof CombativityBreakdown
      >) {
        aggregate[key] += entry.breakdown[key];
      }
      aggregateByRiderId.set(entry.riderId, aggregate);
    }
  }

  return [...aggregateByRiderId.entries()]
    .map(([riderId, breakdown]) => ({
      riderId,
      score: scoreBreakdown(breakdown),
      breakdown: {
        ...breakdown,
        distanceAtFrontKm: roundDistance(breakdown.distanceAtFrontKm),
        activeRelayDistanceKm: roundDistance(
          breakdown.activeRelayDistanceKm,
        ),
        chaseDistanceKm: roundDistance(breakdown.chaseDistanceKm),
      },
    }))
    .sort(compareRanking);
}
