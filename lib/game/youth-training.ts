import type { RiderRatingKey } from "@/lib/game/rider-profile";
import {
  calculateDailyTrainingProgressMilli,
  getPotentialStars,
  getTrainingDomainWeight,
  type TrainingDomain,
} from "@/lib/game/training";

export const YOUTH_TRAINING_DOMAINS = [
  "climber",
  "puncheur",
  "northern_classics",
  "breakaway",
  "sprinter",
  "rouleur",
] as const satisfies ReadonlyArray<TrainingDomain>;

export type YouthTrainingDomain = (typeof YOUTH_TRAINING_DOMAINS)[number];
export type YouthTrainingMode = "automatic" | "manual";
export type YouthManualTrainingSlot = "manual_am" | "manual_pm";
export type YouthTrainingGameType =
  | "rhythm"
  | "reflex"
  | "speed"
  | "time_trial"
  | "breakaway"
  | "puncheur";

export type YouthSeasonTrainingSummary = {
  sessionCount: number;
  automaticSessionCount: number;
  manualSessionCount: number;
  ratingChanges: Record<string, number>;
};

export type YouthMiniGameScoreInput = {
  gameType: YouthTrainingGameType;
  rhythmPoints: number;
  rhythmTaps: number;
  reflexHits: number;
  reflexOpportunities: number;
  speedTaps: number;
  timeTrialOptimalMilliseconds: number;
  timeTrialElapsedMilliseconds: number;
  breakawaySuccessfulAttacks: number;
  breakawayOpportunities: number;
  breakawayEnergy: number;
  puncheurPoints: number;
  puncheurHits: number;
  puncheurOpportunities: number;
};

export const YOUTH_TRAINING_DURATION_SECONDS = 30;
export const YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE = 28;
export const YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE = 940;
export const YOUTH_REFLEX_HITS_FOR_MAX_SCORE = 36;
export const YOUTH_REFLEX_INITIAL_DELAY_MS = 950;
export const YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS = 520;
export const YOUTH_REFLEX_TARGET_INTERVAL_MAX_MS = 880;
export const YOUTH_SPEED_TAPS_FOR_MAX_SCORE = 190;
export const YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE = 0.88;
export const YOUTH_BREAKAWAY_ENERGY_FOR_MAX_SCORE = 30;
export const YOUTH_BREAKAWAY_WINDOW_WIDTH = 0.2;
export const YOUTH_PUNCHEUR_HITS_FOR_MAX_SCORE = 7;
export const YOUTH_PUNCHEUR_TARGET_MIN = 0.73;
export const YOUTH_PUNCHEUR_TARGET_MAX = 0.84;
export const YOUTH_RAW_RATING_MIN = 1;
export const YOUTH_RAW_RATING_MAX = 8.25;
export const YOUTH_RATING_PROJECTION_BASE = 34;
export const YOUTH_RATING_PROJECTION_SCALE = 8;

export const YOUTH_TRAINING_GAME_BY_DOMAIN: Record<
  YouthTrainingDomain,
  YouthTrainingGameType
> = {
  climber: "rhythm",
  puncheur: "puncheur",
  northern_classics: "reflex",
  breakaway: "breakaway",
  sprinter: "speed",
  rouleur: "time_trial",
};

export const YOUTH_TRAINING_GAME_LABELS: Record<
  YouthTrainingGameType,
  string
> = {
  rhythm: "Cadence",
  reflex: "Tape-taupe",
  speed: "Gauche / droite",
  time_trial: "Zone aéro",
  breakaway: "L’échappée",
  puncheur: "La bosse",
};

export function isYouthTrainingDomain(
  value: string,
): value is YouthTrainingDomain {
  return YOUTH_TRAINING_DOMAINS.includes(value as YouthTrainingDomain);
}

export function isYouthTrainingMode(
  value: string,
): value is YouthTrainingMode {
  return value === "automatic" || value === "manual";
}

export function getYouthTrainingGameType(
  domain: YouthTrainingDomain,
): YouthTrainingGameType {
  return YOUTH_TRAINING_GAME_BY_DOMAIN[domain];
}

export function getYouthManualTrainingSlot(
  parisHour: number,
): YouthManualTrainingSlot {
  return parisHour < 12 ? "manual_am" : "manual_pm";
}

export function getYouthRhythmCursorPosition(elapsedMilliseconds: number) {
  const elapsed = Math.max(0, elapsedMilliseconds);
  const rhythmPhase =
    elapsed / 350 -
    Math.PI / 2 +
    Math.sin(elapsed / 2_300) * 2;
  const normalizedPosition = (Math.sin(rhythmPhase) + 1) / 2;
  return 0.02 + normalizedPosition * 0.96;
}

export function getYouthReflexTargetInterval(randomValue: number) {
  const normalizedRandom = clamp(randomValue, 0, 1);
  return Math.round(
    YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS +
      normalizedRandom *
        (YOUTH_REFLEX_TARGET_INTERVAL_MAX_MS -
          YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS),
  );
}

const YOUTH_BREAKAWAY_WINDOW_STARTS = [
  0.16,
  0.52,
  0.29,
  0.67,
  0.41,
  0.22,
] as const;

export function getYouthBreakawayWindowStart(
  cycle: number,
  patternOffset = 0,
) {
  const normalizedCycle = Math.max(0, Math.floor(cycle));
  const normalizedOffset = Math.max(0, Math.floor(patternOffset));
  return YOUTH_BREAKAWAY_WINDOW_STARTS[
    (normalizedCycle + normalizedOffset) %
      YOUTH_BREAKAWAY_WINDOW_STARTS.length
  ];
}

export function getYouthTimeTrialWindDrift(elapsedMilliseconds: number) {
  const elapsed = Math.max(0, elapsedMilliseconds);
  return (
    Math.sin(elapsed / 310) * 0.00009 +
    Math.sin(elapsed / 790 + 1.35) * 0.00007 +
    Math.sin(elapsed / 2_100 + 0.4) * 0.000045
  );
}

export function summarizeYouthSeasonTraining(
  sessions: ReadonlyArray<{
    trainingMode: YouthTrainingMode;
    ratingChanges: Record<string, number>;
  }>,
): YouthSeasonTrainingSummary {
  const ratingChanges: Record<string, number> = {};
  let automaticSessionCount = 0;
  let manualSessionCount = 0;

  for (const session of sessions) {
    if (session.trainingMode === "automatic") {
      automaticSessionCount += 1;
    } else {
      manualSessionCount += 1;
    }

    for (const [key, value] of Object.entries(session.ratingChanges)) {
      if (!Number.isFinite(value)) continue;
      ratingChanges[key] = roundToThousandth(
        (ratingChanges[key] ?? 0) + value,
      );
    }
  }

  return {
    sessionCount: sessions.length,
    automaticSessionCount,
    manualSessionCount,
    ratingChanges,
  };
}

export function getYouthAutomaticFirstDay({
  automaticSinceSeasonId,
  automaticSinceDayNumber,
  currentSeasonId,
}: {
  automaticSinceSeasonId: string | null;
  automaticSinceDayNumber: number | null;
  currentSeasonId: string;
}) {
  if (automaticSinceSeasonId !== currentSeasonId) return 1;
  return Math.min(28, Math.max(1, automaticSinceDayNumber ?? 1));
}

export function isYouthAutomaticTrainingDue({
  dayNumber,
  currentDayNumber,
  parisHour,
}: {
  dayNumber: number;
  currentDayNumber: number;
  parisHour: number;
}) {
  if (dayNumber > currentDayNumber) return false;
  return dayNumber < currentDayNumber || parisHour >= 8;
}

export function getYouthManualTrainingDivisor(projectedRating: number) {
  if (projectedRating < 50) return 1_000;
  if (projectedRating < 60) return 2_000;
  if (projectedRating < 65) return 4_000;
  if (projectedRating < 70) return 6_000;
  return 10_000;
}

export function calculateYouthManualTrainingGain({
  score,
  potentialSteps,
  currentProjectedRating,
  domain,
  ratingKey,
}: {
  score: number;
  potentialSteps: number;
  currentProjectedRating: number;
  domain: YouthTrainingDomain;
  ratingKey: RiderRatingKey;
}) {
  const normalizedScore = Math.min(1_000, Math.max(0, Math.round(score)));
  const rawGain =
    (normalizedScore * getPotentialStars(potentialSteps)) /
    getYouthManualTrainingDivisor(currentProjectedRating);

  return rawGain * getTrainingDomainWeight(domain, ratingKey);
}

export function calculateYouthAutomaticTrainingGain({
  age,
  potentialSteps,
  currentProjectedRating,
  domain,
  ratingKey,
}: {
  age: number;
  potentialSteps: number;
  currentProjectedRating: number;
  domain: YouthTrainingDomain;
  ratingKey: RiderRatingKey;
}) {
  return (
    (calculateDailyTrainingProgressMilli({
      intensity: 100,
      age,
      potentialSteps,
      rating: currentProjectedRating,
      domain,
      ratingKey,
      trainerSpecialty: null,
      trainerLevel: 0,
      trainerCountryMatch: false,
    }) /
      1_000) *
    2
  );
}

export function projectYouthRating(rawRating: number) {
  return clamp(
    YOUTH_RATING_PROJECTION_BASE +
      rawRating * YOUTH_RATING_PROJECTION_SCALE,
    0,
    100,
  );
}

export function unprojectYouthRating(projectedRating: number) {
  return clamp(
    (projectedRating - YOUTH_RATING_PROJECTION_BASE) /
      YOUTH_RATING_PROJECTION_SCALE,
    YOUTH_RAW_RATING_MIN,
    YOUTH_RAW_RATING_MAX,
  );
}

export function projectedGainToRawGain(projectedGain: number) {
  return Math.max(0, projectedGain) / YOUTH_RATING_PROJECTION_SCALE;
}

export function calculateYouthMiniGameScore({
  gameType,
  rhythmPoints,
  rhythmTaps,
  reflexHits,
  reflexOpportunities,
  speedTaps,
  timeTrialOptimalMilliseconds,
  timeTrialElapsedMilliseconds,
  breakawaySuccessfulAttacks,
  breakawayOpportunities,
  breakawayEnergy,
  puncheurPoints,
  puncheurHits,
  puncheurOpportunities,
}: YouthMiniGameScoreInput) {
  if (gameType === "rhythm") {
    if (rhythmTaps <= 0) return 0;
    const averageAccuracy = rhythmPoints / rhythmTaps;
    const accuracyFactor = Math.min(
      1,
      averageAccuracy / YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE,
    );
    const cadenceFactor = Math.min(
      1,
      rhythmTaps / YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE,
    );
    return clampScore(
      Math.round(
        1_000 * accuracyFactor * (0.65 + cadenceFactor * 0.35),
      ),
    );
  }

  if (gameType === "reflex") {
    if (reflexOpportunities <= 0) return 0;
    const hitRate = reflexHits / reflexOpportunities;
    return clampScore(
      Math.round(
        hitRate * 800 +
          Math.min(1, reflexHits / YOUTH_REFLEX_HITS_FOR_MAX_SCORE) * 200,
      ),
    );
  }

  if (gameType === "speed") {
    return clampScore(
      Math.round((speedTaps / YOUTH_SPEED_TAPS_FOR_MAX_SCORE) * 1_000),
    );
  }

  if (gameType === "time_trial") {
    if (timeTrialElapsedMilliseconds <= 0) return 0;
    const optimalRatio =
      timeTrialOptimalMilliseconds / timeTrialElapsedMilliseconds;
    return clampScore(
      Math.round(
        (optimalRatio / YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE) *
          1_000,
      ),
    );
  }

  if (gameType === "breakaway") {
    if (breakawayOpportunities <= 0) return 0;
    const successRate =
      breakawaySuccessfulAttacks / breakawayOpportunities;
    const energyFactor = Math.min(
      1,
      Math.max(0, breakawayEnergy) /
        YOUTH_BREAKAWAY_ENERGY_FOR_MAX_SCORE,
    );
    return clampScore(Math.round(successRate * 850 + energyFactor * 150));
  }

  if (puncheurOpportunities <= 0) return 0;
  const hitFactor = Math.min(
    1,
    Math.max(0, puncheurHits) / YOUTH_PUNCHEUR_HITS_FOR_MAX_SCORE,
  );
  const accuracyFactor = Math.min(
    1,
    Math.max(0, puncheurPoints) / (puncheurOpportunities * 1_000),
  );
  return clampScore(
    Math.round((hitFactor * 0.85 + accuracyFactor * 0.15) * 1_000),
  );
}

export function getYouthPuncheurChargeRateMultiplier(charge: number) {
  const normalizedCharge = clamp(charge, 0, 1);
  return 0.7 + normalizedCharge ** 2 * 1.9;
}

export function calculateYouthPuncheurReleasePoints(charge: number) {
  const normalizedCharge = clamp(charge, 0, 1);
  if (
    normalizedCharge >= YOUTH_PUNCHEUR_TARGET_MIN &&
    normalizedCharge <= YOUTH_PUNCHEUR_TARGET_MAX
  ) {
    return 1_000;
  }

  const distanceFromTarget =
    normalizedCharge < YOUTH_PUNCHEUR_TARGET_MIN
      ? YOUTH_PUNCHEUR_TARGET_MIN - normalizedCharge
      : normalizedCharge - YOUTH_PUNCHEUR_TARGET_MAX;

  return clampScore(Math.round((1 - distanceFromTarget / 0.14) * 1_000));
}

function clampScore(score: number) {
  return Math.min(1_000, Math.max(0, score));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundToThousandth(value: number) {
  return Math.round(value * 1_000) / 1_000;
}
