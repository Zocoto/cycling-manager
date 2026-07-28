export const RIDER_EXPERIENCE_SCORE_MAX = 100;
export const RIDER_EXPERIENCE_MAX_RACE_BONUS = 1.5;
export const RIDER_EXPERIENCE_RACE_DAYS_FOR_MAX_SCORE = 500;

export const RIDER_EXPERIENCE_LEVELS = [
  { minimumScore: 0, label: "Débutant" },
  { minimumScore: 20, label: "En apprentissage" },
  { minimumScore: 40, label: "Confirmé" },
  { minimumScore: 60, label: "Expérimenté" },
  { minimumScore: 80, label: "Vétéran" },
] as const;

export type RiderExperienceLevel =
  (typeof RIDER_EXPERIENCE_LEVELS)[number]["label"];

export type RiderExperience = {
  raceDays: number;
  score: number;
  level: RiderExperienceLevel;
  raceBonus: number;
};

export function getRiderExperience(raceDays: number): RiderExperience {
  const normalizedRaceDays = normalizeRiderRaceDays(raceDays);
  const score = getRiderExperienceScore(normalizedRaceDays);

  return {
    raceDays: normalizedRaceDays,
    score,
    level: getRiderExperienceLevel(score),
    raceBonus: getRiderExperienceRaceBonus(normalizedRaceDays),
  };
}

export function getRiderExperienceScore(raceDays: number) {
  const normalizedRaceDays = normalizeRiderRaceDays(raceDays);
  return round(
    Math.min(
      RIDER_EXPERIENCE_SCORE_MAX,
      (normalizedRaceDays / RIDER_EXPERIENCE_RACE_DAYS_FOR_MAX_SCORE) *
        RIDER_EXPERIENCE_SCORE_MAX,
    ),
    1,
  );
}

export function getRiderExperienceRaceBonus(raceDays: number) {
  const score = getRiderExperienceScore(raceDays);
  return round(
    (score / RIDER_EXPERIENCE_SCORE_MAX) *
      RIDER_EXPERIENCE_MAX_RACE_BONUS,
    3,
  );
}

export function getRiderExperienceLevel(
  score: number,
): RiderExperienceLevel {
  const normalizedScore = Math.max(
    0,
    Math.min(RIDER_EXPERIENCE_SCORE_MAX, score),
  );

  return [...RIDER_EXPERIENCE_LEVELS]
    .reverse()
    .find((level) => normalizedScore >= level.minimumScore)!.label;
}

function normalizeRiderRaceDays(raceDays: number) {
  return Number.isFinite(raceDays) ? Math.max(0, Math.floor(raceDays)) : 0;
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
