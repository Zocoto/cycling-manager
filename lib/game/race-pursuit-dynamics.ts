export type RacePursuitPhase =
  | "watching"
  | "control"
  | "chase"
  | "all_in";

export type RacePursuitState = {
  pressure: number;
  targetPressure: number;
  phase: RacePursuitPhase;
};

export type RacePursuitContext = {
  raceProgress: number;
  hasBreakaway: boolean;
  breakawayGapSeconds: number;
  breakawayThreat: number;
  chaseCapacity: number;
  strategyModifier: number;
  pelotonAverageEnergy: number;
  breakawayAverageEnergy: number;
  terrain: "flat" | "climb" | "descent";
  surface: "asphalt" | "cobbles";
  isWet: boolean;
  likelyMassSprint: boolean;
  pelotonHasGivenUp: boolean;
};

export const INITIAL_RACE_PURSUIT_STATE: RacePursuitState = {
  pressure: 0.12,
  targetPressure: 0.12,
  phase: "watching",
};

/**
 * Continuous target replacing abrupt early/mid/late race thresholds. Existing
 * team orders are received through `strategyModifier`; equipment, form and
 * weather-adjusted rider ratings influence `chaseCapacity` and current energy.
 */
export function getRacePursuitTargetPressure({
  raceProgress,
  hasBreakaway,
  breakawayGapSeconds,
  breakawayThreat,
  chaseCapacity,
  strategyModifier,
  pelotonAverageEnergy,
  breakawayAverageEnergy,
  terrain,
  surface,
  isWet,
  likelyMassSprint,
  pelotonHasGivenUp,
}: RacePursuitContext) {
  if (pelotonHasGivenUp) return 0.1;

  const progress = clamp(raceProgress, 0, 1);
  const controlProgress = smoothstep(0.16, 0.68, progress);
  const finaleProgress = smoothstep(0.56, 0.96, progress);

  if (!hasBreakaway) {
    return clamp(
      0.08 + finaleProgress * 0.24 + Math.max(0, strategyModifier) * 0.45,
      0.06,
      0.42,
    );
  }

  const gapUrgency = smoothstep(45, 390, breakawayGapSeconds);
  const threat = clamp(breakawayThreat, 0, 1);
  const capacity = clamp(chaseCapacity, 0, 1);
  const energyBalance = clamp(
    (pelotonAverageEnergy - breakawayAverageEnergy) / 35,
    -1,
    1,
  );
  const terrainEfficiency =
    terrain === "flat" ? 0.025 : terrain === "climb" ? -0.035 : -0.05;
  const surfacePenalty = surface === "cobbles" ? -0.025 : 0;
  const weatherPenalty = isWet ? -0.02 : 0;
  const sprintUrgency = likelyMassSprint ? finaleProgress * 0.08 : 0;
  const basePressure =
    0.1 + controlProgress * 0.1 + finaleProgress * 0.11;
  const capacityWeight = 0.2 + controlProgress * 0.26;
  const threatWeight = 0.28 + controlProgress * 0.08;

  return clamp(
    basePressure +
      capacity * capacityWeight +
      threat * threatWeight +
      gapUrgency * 0.22 +
      finaleProgress * 0.22 +
      sprintUrgency +
      energyBalance * 0.045 +
      terrainEfficiency +
      surfacePenalty +
      weatherPenalty +
      strategyModifier,
    0.06,
    1,
  );
}

export function evolveRacePursuitState({
  previousState,
  context,
}: {
  previousState: RacePursuitState;
  context: RacePursuitContext;
}): RacePursuitState {
  const targetPressure = getRacePursuitTargetPressure(context);
  const finaleProgress = smoothstep(0.56, 0.96, context.raceProgress);
  const gapUrgency = smoothstep(45, 390, context.breakawayGapSeconds);
  const responsiveness = clamp(
    0.3 +
      finaleProgress * 0.3 +
      clamp(context.breakawayThreat, 0, 1) * 0.14 +
      gapUrgency * 0.1,
    0.25,
    0.82,
  );
  const pressure = clamp(
    previousState.pressure +
      (targetPressure - previousState.pressure) * responsiveness,
    0.06,
    1,
  );

  return {
    pressure,
    targetPressure,
    phase: getRacePursuitPhase({
      pressure,
      raceProgress: context.raceProgress,
      hasBreakaway: context.hasBreakaway,
    }),
  };
}

export function getRacePursuitPhase({
  pressure,
  raceProgress,
  hasBreakaway,
}: {
  pressure: number;
  raceProgress: number;
  hasBreakaway: boolean;
}): RacePursuitPhase {
  if (!hasBreakaway) return "watching";
  if (pressure >= 0.82 || (raceProgress >= 0.9 && pressure >= 0.68)) {
    return "all_in";
  }
  if (pressure >= 0.56) return "chase";
  return "control";
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
