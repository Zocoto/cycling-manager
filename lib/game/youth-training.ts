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
export type YouthTrainingGameType = "rhythm" | "reflex" | "speed";

export type YouthMiniGameScoreInput = {
  gameType: YouthTrainingGameType;
  rhythmPoints: number;
  rhythmTaps: number;
  reflexHits: number;
  reflexOpportunities: number;
  speedTaps: number;
};

export const YOUTH_TRAINING_DURATION_SECONDS = 35;
export const YOUTH_RAW_RATING_MIN = 1;
export const YOUTH_RAW_RATING_MAX = 8.25;
export const YOUTH_RATING_PROJECTION_BASE = 34;
export const YOUTH_RATING_PROJECTION_SCALE = 8;

export const YOUTH_TRAINING_GAME_BY_DOMAIN: Record<
  YouthTrainingDomain,
  YouthTrainingGameType
> = {
  climber: "rhythm",
  puncheur: "rhythm",
  northern_classics: "reflex",
  breakaway: "reflex",
  sprinter: "speed",
  rouleur: "speed",
};

export const YOUTH_TRAINING_GAME_LABELS: Record<
  YouthTrainingGameType,
  string
> = {
  rhythm: "Jeu d’endurance",
  reflex: "Jeu de réflexe",
  speed: "Jeu de vitesse",
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
}: YouthMiniGameScoreInput) {
  if (gameType === "rhythm") {
    if (rhythmTaps <= 0) return 0;
    const averageAccuracy = rhythmPoints / rhythmTaps;
    const cadenceFactor = Math.min(1, rhythmTaps / 28);
    return clampScore(
      Math.round(averageAccuracy * (0.65 + cadenceFactor * 0.35)),
    );
  }

  if (gameType === "reflex") {
    if (reflexOpportunities <= 0) return 0;
    const hitRate = reflexHits / reflexOpportunities;
    return clampScore(
      Math.round(hitRate * 800 + Math.min(1, reflexHits / 32) * 200),
    );
  }

  return clampScore(Math.round((speedTaps / 180) * 1_000));
}

function clampScore(score: number) {
  return Math.min(1_000, Math.max(0, score));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
