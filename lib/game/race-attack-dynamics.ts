import type { RaceProfileType } from "./race-calendar";
import type { RaceStageSegment } from "./race-profiles";

export type DynamicAttackKind = "counter_attack" | "decisive_attack";

export type DynamicAttackWindow = {
  kind: DynamicAttackKind;
  tickIndex: number;
  atDistanceKm: number;
  remainingDistanceKm: number;
  raceProgress: number;
  opportunity: number;
};

export const DYNAMIC_COUNTER_ATTACK_COOLDOWN_KM = 12;
export const DYNAMIC_DECISIVE_ATTACK_COOLDOWN_KM = 10;

export function findBestDynamicAttackWindow({
  kind,
  ticks,
  completedDistanceKm,
  totalDistanceKm,
  profileType,
  breakawayGapSeconds,
  chasePressure,
  hasBreakaway,
  likelyMassSprint,
  isWet,
}: {
  kind: DynamicAttackKind;
  ticks: RaceStageSegment[];
  completedDistanceKm: number;
  totalDistanceKm: number;
  profileType: RaceProfileType;
  breakawayGapSeconds: number;
  chasePressure: number;
  hasBreakaway: boolean;
  likelyMassSprint: boolean;
  isWet: boolean;
}): DynamicAttackWindow | null {
  if (ticks.length === 0 || totalDistanceKm <= 0) return null;
  if (kind === "decisive_attack" && totalDistanceKm < 40) return null;

  let tickStartDistanceKm = completedDistanceKm;
  const windows = ticks.map((tick, tickIndex) => {
    const atDistanceKm = Math.min(
      totalDistanceKm,
      tickStartDistanceKm + tick.distanceKm * 0.5,
    );
    tickStartDistanceKm += tick.distanceKm;
    const raceProgress = clamp(atDistanceKm / totalDistanceKm, 0, 1);
    const opportunity =
      kind === "counter_attack"
        ? getCounterAttackOpportunity({
            raceProgress,
            segment: tick,
            breakawayGapSeconds,
            chasePressure,
            hasBreakaway,
            isWet,
          })
        : getDecisiveAttackOpportunity({
            raceProgress,
            segment: tick,
            profileType,
            chasePressure,
            likelyMassSprint,
            isWet,
          });

    return {
      kind,
      tickIndex,
      atDistanceKm,
      remainingDistanceKm: Math.max(0, totalDistanceKm - atDistanceKm),
      raceProgress,
      opportunity,
    } satisfies DynamicAttackWindow;
  });
  const best = windows.sort(
    (first, second) =>
      second.opportunity - first.opportunity ||
      first.tickIndex - second.tickIndex,
  )[0];
  const minimumOpportunity = kind === "counter_attack" ? 0.42 : 0.46;

  return best && best.opportunity >= minimumOpportunity ? best : null;
}

export function isDynamicAttackCooldownReady({
  window,
  lastAttackAtKm,
  cooldownKm,
}: {
  window: DynamicAttackWindow | null;
  lastAttackAtKm: number;
  cooldownKm: number;
}) {
  return Boolean(
    window && window.atDistanceKm - lastAttackAtKm >= cooldownKm,
  );
}

function getCounterAttackOpportunity({
  raceProgress,
  segment,
  breakawayGapSeconds,
  chasePressure,
  hasBreakaway,
  isWet,
}: {
  raceProgress: number;
  segment: RaceStageSegment;
  breakawayGapSeconds: number;
  chasePressure: number;
  hasBreakaway: boolean;
  isWet: boolean;
}) {
  if (!hasBreakaway || chasePressure >= 0.78) return 0;

  const activeRaceWindow = bellWindow(raceProgress, 0.1, 0.42, 0.8);
  const gapWindow = bellWindow(breakawayGapSeconds, 22, 105, 245);
  const quietPeloton = 1 - smoothstep(0.36, 0.72, chasePressure);
  const terrainOpportunity =
    segment.terrain === "descent"
      ? 0.1
      : segment.terrain === "climb"
        ? 0.08
        : 0.04;
  const surfaceOpportunity = segment.surface === "cobbles" ? 0.06 : 0;

  return clamp(
    activeRaceWindow * 0.34 +
      gapWindow * 0.32 +
      quietPeloton * 0.25 +
      terrainOpportunity +
      surfaceOpportunity -
      (isWet ? 0.025 : 0),
    0,
    1,
  );
}

function getDecisiveAttackOpportunity({
  raceProgress,
  segment,
  profileType,
  chasePressure,
  likelyMassSprint,
  isWet,
}: {
  raceProgress: number;
  segment: RaceStageSegment;
  profileType: RaceProfileType;
  chasePressure: number;
  likelyMassSprint: boolean;
  isWet: boolean;
}) {
  const finaleWindow = bellWindow(raceProgress, 0.52, 0.86, 0.992);
  const gradient = Math.abs(segment.averageGradientPct);
  const terrainSelectivity =
    segment.surface === "cobbles"
      ? 0.92
      : segment.terrain === "climb"
        ? clamp(0.42 + gradient / 11, 0.42, 1)
        : profileType === "hilly"
          ? 0.32
          : 0.08;
  const pressureOpportunity = smoothstep(0.3, 0.82, chasePressure);
  const massSprintPenalty =
    likelyMassSprint && profileType !== "cobbles" ? 0.34 : 0;

  return clamp(
    finaleWindow * 0.5 +
      terrainSelectivity * 0.36 +
      pressureOpportunity * 0.12 +
      (isWet && segment.terrain === "descent" ? -0.08 : 0) -
      massSprintPenalty,
    0,
    1,
  );
}

function bellWindow(
  value: number,
  start: number,
  peak: number,
  end: number,
) {
  if (value <= start || value >= end) return 0;
  if (value <= peak) return smoothstep(start, peak, value);
  return 1 - smoothstep(peak, end, value);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
