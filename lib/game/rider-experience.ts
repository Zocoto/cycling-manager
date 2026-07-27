export const RIDER_EXPERIENCE_SCORE_MAX = 100;
export const RIDER_EXPERIENCE_MAX_RACE_BONUS = 1.5;

const RIDER_EXPERIENCE_RACE_DAY_SCALE = 180;

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
  return Math.min(
    RIDER_EXPERIENCE_SCORE_MAX,
    Math.round(
      RIDER_EXPERIENCE_SCORE_MAX *
        (1 - Math.exp(-normalizedRaceDays / RIDER_EXPERIENCE_RACE_DAY_SCALE)),
    ),
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
    Math.min(RIDER_EXPERIENCE_SCORE_MAX, Math.round(score)),
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
