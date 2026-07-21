import type { RiderRatingKey, RiderRatings } from "@/lib/game/rider-profile";

export const TRAINING_DOMAINS = [
  "climber",
  "puncheur",
  "stage_racer",
  "northern_classics",
  "rouleur",
  "breakaway",
  "sprinter",
] as const;

export type TrainingDomain = (typeof TRAINING_DOMAINS)[number];

export const TRAINING_DOMAIN_LABELS: Record<TrainingDomain, string> = {
  climber: "Grimpeur",
  puncheur: "Puncheur",
  stage_racer: "Coureur de tour",
  northern_classics: "Classiques du Nord",
  rouleur: "Rouleur",
  breakaway: "Baroudeur",
  sprinter: "Sprinteur",
};

export const POTENTIAL_MIN_STEPS = 1;
export const POTENTIAL_MAX_STEPS = 8;

export type TrainerSpecialty =
  | "mountain"
  | "hills"
  | "flat"
  | "sprint"
  | "time_trial"
  | "cobbles"
  | "endurance";

const PRIMARY_STATS: Record<TrainingDomain, readonly RiderRatingKey[]> = {
  climber: ["mountain", "endurance"],
  puncheur: ["hills", "acceleration"],
  stage_racer: ["recovery", "endurance", "timeTrial"],
  northern_classics: ["cobbles", "resistance", "flat"],
  rouleur: ["timeTrial", "flat", "prologue"],
  breakaway: ["breakaway", "endurance", "resistance"],
  sprinter: ["sprint", "acceleration", "flat"],
};

const SECONDARY_STATS: Record<TrainingDomain, readonly RiderRatingKey[]> = {
  climber: ["hills", "recovery", "downhill", "acceleration"],
  puncheur: ["mountain", "sprint", "resistance", "breakaway"],
  stage_racer: ["mountain", "hills", "resistance", "prologue"],
  northern_classics: ["endurance", "acceleration", "sprint", "breakaway"],
  rouleur: ["endurance", "resistance", "recovery"],
  breakaway: ["hills", "flat", "recovery", "downhill"],
  sprinter: ["resistance", "prologue", "cobbles"],
};

const TRAINER_SPECIALTY_STATS: Record<TrainerSpecialty, readonly RiderRatingKey[]> = {
  mountain: ["mountain"],
  hills: ["hills"],
  flat: ["flat"],
  sprint: ["sprint", "acceleration"],
  time_trial: ["timeTrial", "prologue"],
  cobbles: ["cobbles"],
  endurance: ["endurance", "resistance", "recovery", "breakaway", "downhill"],
};

export function normalizePotentialSteps(value: number): number {
  return Math.min(POTENTIAL_MAX_STEPS, Math.max(POTENTIAL_MIN_STEPS, Math.round(value)));
}

export function getPotentialStars(potentialSteps: number): number {
  return normalizePotentialSteps(potentialSteps) / 2;
}

export function getPotentialOverallCap(potentialSteps: number): number {
  return 60 + normalizePotentialSteps(potentialSteps) * 5;
}

export function getPotentialEfficiency(potentialSteps: number): number {
  return 0.6 + normalizePotentialSteps(potentialSteps) * 0.05;
}

export function getTrainingFormDelta(intensity: number): number {
  const normalized = Math.min(100, Math.max(0, Math.round(intensity)));
  if (normalized <= 50) {
    return Math.round(2 * (1 - normalized / 50));
  }
  return -Math.round((normalized - 50) / 2);
}

export function getTrainingDomainWeight(
  domain: TrainingDomain,
  ratingKey: RiderRatingKey,
): number {
  if (PRIMARY_STATS[domain].includes(ratingKey)) return 1;
  if (SECONDARY_STATS[domain].includes(ratingKey)) return 0.55;
  return 0.1;
}

export function getTrainerMultiplier({
  specialty,
  level,
  ratingKey,
  countryMatch = false,
}: {
  specialty: TrainerSpecialty | null;
  level: number;
  ratingKey: RiderRatingKey;
  countryMatch?: boolean;
}): number {
  const specialtyBonus =
    specialty && TRAINER_SPECIALTY_STATS[specialty].includes(ratingKey)
      ? Math.min(5, Math.max(1, Math.round(level))) * 0.04
      : 0;
  const nationalityBonus = countryMatch ? 0.05 : 0;
  return 1 + specialtyBonus + nationalityBonus;
}

export function getTrainingAgeFactor(age: number): number {
  if (age <= 21) return 1;
  if (age <= 24) return 0.95;
  if (age <= 27) return 0.85;
  if (age <= 29) return 0.72;
  if (age <= 31) return 0.55;
  return Math.max(0.2, 0.5 - (age - 32) * 0.04);
}

export function getRatingProgressFactor(rating: number): number {
  if (rating < 50) return 1.8;
  if (rating < 60) return 1.35;
  if (rating < 70) return 1;
  if (rating < 80) return 0.65;
  if (rating < 90) return 0.35;
  return 0.15;
}

export function getSeasonRatingGainCap(initialRating: number): number {
  if (initialRating < 60) return 18;
  if (initialRating < 70) return 12;
  if (initialRating < 80) return 8;
  if (initialRating < 90) return 4;
  return 2;
}

export function getSeasonDeclinePoints(age: number): number {
  if (age < 32) return 0;
  return Math.min(7, 1 + (age - 32) * 0.5);
}

export function calculateDailyTrainingProgressMilli({
  intensity,
  age,
  potentialSteps,
  rating,
  domain,
  ratingKey,
  trainerSpecialty = null,
  trainerLevel = 0,
  trainerCountryMatch = false,
}: {
  intensity: number;
  age: number;
  potentialSteps: number;
  rating: number;
  domain: TrainingDomain;
  ratingKey: RiderRatingKey;
  trainerSpecialty?: TrainerSpecialty | null;
  trainerLevel?: number;
  trainerCountryMatch?: boolean;
}): number {
  const intensityFactor = Math.min(100, Math.max(0, intensity)) / 100;
  const raw =
    (10_000 / 28) *
    intensityFactor *
    getTrainingAgeFactor(age) *
    getPotentialEfficiency(potentialSteps) *
    getRatingProgressFactor(rating) *
    getTrainingDomainWeight(domain, ratingKey) *
    getTrainerMultiplier({
      specialty: trainerSpecialty,
      level: trainerLevel,
      ratingKey,
      countryMatch: trainerCountryMatch,
    });

  return Math.max(0, Math.round(raw));
}

export function canIncreaseWithinPotentialCap({
  ratings,
  ratingKey,
  potentialSteps,
}: {
  ratings: RiderRatings;
  ratingKey: RiderRatingKey;
  potentialSteps: number;
}): boolean {
  if (ratings[ratingKey] >= 100) return false;
  const total = Object.values(ratings).reduce((sum, value) => sum + value, 0);
  return total + 1 <= getPotentialOverallCap(potentialSteps) * 13;
}

export function formatPotential(potentialSteps: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    getPotentialStars(potentialSteps),
  )} étoile${getPotentialStars(potentialSteps) > 1 ? "s" : ""}`;
}

export function isTrainingDomain(value: string): value is TrainingDomain {
  return TRAINING_DOMAINS.includes(value as TrainingDomain);
}
