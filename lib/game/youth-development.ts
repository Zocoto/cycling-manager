import type { RiderRatingKey, RiderRatings } from "@/lib/game/rider-profile";
import { TRAINING_DOMAIN_LABELS, type TrainingDomain } from "@/lib/game/training";
import {
  YOUTH_TRAINING_DOMAINS,
  isYouthTrainingDomain,
  type YouthTrainingDomain,
} from "@/lib/game/youth-training";

export const YOUTH_RATING_KEYS = [
  "mountain",
  "hills",
  "flat",
  "timeTrial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const satisfies ReadonlyArray<RiderRatingKey>;

export type YouthArchetype = TrainingDomain | "all_rounder";
export type YouthRatings = RiderRatings;

const YOUTH_BASE_RATING_BY_AGE: Record<number, number> = {
  15: 1,
  16: 1,
  17: 1.5,
  18: 2.6,
};

export const YOUTH_INITIAL_PROJECTED_OVERALL_MAX = 65;
const YOUTH_INITIAL_RAW_OVERALL_MAX =
  (YOUTH_INITIAL_PROJECTED_OVERALL_MAX - 34) / 8;

export const YOUTH_ARCHETYPE_LABELS: Record<YouthArchetype, string> = {
  ...TRAINING_DOMAIN_LABELS,
  all_rounder: "Polyvalent",
};

export const YOUTH_TRAINING_PRIORITIES = YOUTH_TRAINING_DOMAINS;

const ARCHETYPE_PRIMARY_STATS: Record<YouthArchetype, readonly RiderRatingKey[]> = {
  climber: ["mountain", "endurance", "recovery"],
  puncheur: ["hills", "acceleration", "breakaway"],
  stage_racer: ["mountain", "hills", "timeTrial", "recovery"],
  northern_classics: ["cobbles", "resistance", "flat", "endurance"],
  rouleur: ["timeTrial", "flat", "prologue", "resistance"],
  breakaway: ["breakaway", "endurance", "resistance", "hills"],
  sprinter: ["sprint", "acceleration", "flat", "prologue"],
  all_rounder: ["flat", "hills", "endurance", "resistance", "recovery"],
};

const ARCHETYPE_SECONDARY_STATS: Record<YouthArchetype, readonly RiderRatingKey[]> = {
  climber: ["hills", "downhill", "acceleration"],
  puncheur: ["sprint", "mountain", "resistance"],
  stage_racer: ["endurance", "resistance", "downhill", "prologue"],
  northern_classics: ["sprint", "acceleration", "breakaway"],
  rouleur: ["endurance", "recovery", "downhill"],
  breakaway: ["flat", "recovery", "downhill"],
  sprinter: ["resistance", "cobbles", "endurance"],
  all_rounder: ["mountain", "timeTrial", "downhill", "breakaway"],
};

const COUNTRY_SPECIALTIES: Array<{
  codes: readonly string[];
  primary: YouthArchetype;
  secondary: YouthArchetype;
}> = [
  { codes: ["BE", "NL"], primary: "northern_classics", secondary: "puncheur" },
  { codes: ["CO", "EC", "BO", "PE"], primary: "climber", secondary: "stage_racer" },
  { codes: ["SI", "HR", "BA", "ME"], primary: "stage_racer", secondary: "puncheur" },
  { codes: ["ES", "IT", "FR", "PT"], primary: "climber", secondary: "puncheur" },
  { codes: ["GB", "AU", "NZ", "DE", "DK"], primary: "rouleur", secondary: "sprinter" },
  { codes: ["CH", "AT"], primary: "stage_racer", secondary: "climber" },
  { codes: ["NO", "SE", "FI", "EE", "LV", "LT"], primary: "rouleur", secondary: "northern_classics" },
  { codes: ["US", "CA"], primary: "rouleur", secondary: "stage_racer" },
  { codes: ["ER", "ET", "RW", "UG", "KE"], primary: "climber", secondary: "breakaway" },
  { codes: ["JP", "KR", "CN"], primary: "sprinter", secondary: "rouleur" },
  { codes: ["CZ", "SK", "PL", "HU"], primary: "northern_classics", secondary: "rouleur" },
  { codes: ["IE", "IS"], primary: "breakaway", secondary: "rouleur" },
  { codes: ["MA", "DZ", "TN", "TR", "GR"], primary: "puncheur", secondary: "climber" },
  { codes: ["AR", "UY", "BR", "PY", "CL"], primary: "puncheur", secondary: "rouleur" },
  { codes: ["ZA", "NA", "BW", "ZW"], primary: "rouleur", secondary: "breakaway" },
];

const COUNTRY_BASE_REPUTATION: Record<string, number> = {
  BE: 10,
  FR: 10,
  IT: 10,
  ES: 9,
  NL: 9,
  SI: 9,
  DK: 8,
  GB: 8,
  AU: 8,
  CO: 8,
  DE: 7,
  CH: 7,
  US: 7,
  NO: 7,
  PT: 7,
  AT: 6,
  CZ: 6,
  IE: 6,
  NZ: 6,
  ER: 6,
  EC: 6,
  PL: 5,
  SK: 5,
  CA: 5,
  ZA: 5,
  JP: 5,
  KZ: 5,
  HR: 5,
};

export function getCountryYouthSpecialties(countryCode: string) {
  const normalized = countryCode.trim().toUpperCase();
  const profile = COUNTRY_SPECIALTIES.find((entry) =>
    entry.codes.includes(normalized),
  );
  return profile
    ? { primary: profile.primary, secondary: profile.secondary }
    : { primary: "all_rounder" as const, secondary: "breakaway" as const };
}

export function getCountryBaseReputation(countryCode: string): number {
  return COUNTRY_BASE_REPUTATION[countryCode.trim().toUpperCase()] ?? 2;
}

export function calculateCountryWorldReputation({
  baseReputation,
  seasonUciPoints,
}: {
  baseReputation: number;
  seasonUciPoints: readonly number[];
}): number {
  const seasons = seasonUciPoints.slice(0, 10);
  if (seasons.length === 0) return clamp(Math.round(baseReputation), 1, 10);

  const weightedAverage =
    seasons.reduce(
      (total, points, index) => total + Math.max(0, points) * (1 - index * 0.07),
      0,
    ) / seasons.reduce((total, _, index) => total + (1 - index * 0.07), 0);
  const thresholds = [0, 35, 90, 180, 320, 520, 800, 1_150, 1_600, 2_200];
  const earnedReputation = thresholds.reduce(
    (level, threshold, index) => (weightedAverage >= threshold ? index + 1 : level),
    1,
  );
  const historyWeight = Math.min(1, seasons.length / 10);

  return clamp(
    Math.round(baseReputation * (1 - historyWeight) + earnedReputation * historyWeight),
    1,
    10,
  );
}

export function getScoutingCandidateCount({
  scoutLevel,
  durationDays,
  facilityLevel,
  random,
}: {
  scoutLevel: number;
  durationDays: number;
  facilityLevel: number;
  random: () => number;
}): number {
  const score = scoutLevel * 0.55 + durationDays * 0.34 + facilityLevel * 0.12;
  return clamp(Math.floor(score / 1.65 + random() * 1.35), 1, 4);
}

export function generateYouthRatings({
  archetype,
  age,
  talent,
  countryReputation = 5,
  accuracyBonus = 0,
  initialRatingBonus = 0,
  random,
}: {
  archetype: YouthArchetype;
  age: number;
  talent: number;
  countryReputation?: number;
  accuracyBonus?: number;
  initialRatingBonus?: number;
  random: () => number;
}): YouthRatings {
  const primary = new Set(ARCHETYPE_PRIMARY_STATS[archetype]);
  const secondary = new Set(ARCHETYPE_SECONDARY_STATS[archetype]);
  const safeAge = clamp(Math.round(age), 15, 18);
  const safeTalent = clamp(talent, 1, 8);
  const safeCountryReputation = clamp(countryReputation, 1, 10);
  const baseRating = YOUTH_BASE_RATING_BY_AGE[safeAge];
  const talentAdjustment = (safeTalent - 4.5) * 0.055;
  const countryAdjustment = (safeCountryReputation - 5.5) * 0.025;
  const exceptionalChance = clamp(
    0.025 +
      safeTalent * 0.005 +
      safeCountryReputation * 0.0015 +
      initialRatingBonus * 0.05,
    0.03,
    0.09,
  );
  const exceptionalBoost =
    random() < exceptionalChance ? 0.55 + random() * 0.55 : 0;
  const ratings = Object.fromEntries(
    YOUTH_RATING_KEYS.map((key) => {
      const archetypeAdjustment = primary.has(key)
        ? 0.25
        : secondary.has(key)
          ? 0
          : -0.32;
      const scoutingAdjustment = primary.has(key)
        ? accuracyBonus + initialRatingBonus
        : secondary.has(key)
          ? accuracyBonus * 0.45 + initialRatingBonus * 0.75
          : initialRatingBonus * 0.35;
      const exceptionalAdjustment = primary.has(key)
        ? exceptionalBoost
        : secondary.has(key)
          ? exceptionalBoost * 0.35
          : 0;

      return [
        key,
        roundYouthRating(
          baseRating +
            archetypeAdjustment +
            talentAdjustment +
            countryAdjustment +
            scoutingAdjustment +
            exceptionalAdjustment +
            (random() - 0.5) * 0.7,
        ),
      ];
    }),
  ) as YouthRatings;

  if (archetype === "climber") {
    ratings.sprint = Math.min(ratings.sprint, 2.6);
    ratings.flat = Math.min(ratings.flat, 3.2);
  }
  if (archetype === "sprinter") {
    ratings.mountain = Math.min(ratings.mountain, 2.5);
    ratings.recovery = Math.min(ratings.recovery, 3.5);
  }

  return capYouthInitialRatings(ratings);
}

export function calculateYouthProjectedOverall(ratings: YouthRatings) {
  return (
    YOUTH_RATING_KEYS.reduce(
      (total, key) => total + 34 + ratings[key] * 8,
      0,
    ) / YOUTH_RATING_KEYS.length
  );
}

function capYouthInitialRatings(ratings: YouthRatings): YouthRatings {
  if (
    calculateYouthProjectedOverall(ratings) <=
    YOUTH_INITIAL_PROJECTED_OVERALL_MAX
  ) {
    return ratings;
  }

  const targetRawTotal =
    YOUTH_INITIAL_RAW_OVERALL_MAX * YOUTH_RATING_KEYS.length;
  const reducibleTotal = YOUTH_RATING_KEYS.reduce(
    (total, key) => total + Math.max(0, ratings[key] - 1),
    0,
  );
  const scale = Math.max(
    0,
    Math.min(
      1,
      (targetRawTotal - YOUTH_RATING_KEYS.length) /
        Math.max(0.001, reducibleTotal),
    ),
  );
  const capped = Object.fromEntries(
    YOUTH_RATING_KEYS.map((key) => [
      key,
      roundYouthRating(1 + Math.max(0, ratings[key] - 1) * scale),
    ]),
  ) as YouthRatings;

  while (
    YOUTH_RATING_KEYS.reduce((total, key) => total + capped[key], 0) >
    targetRawTotal
  ) {
    const strongestKey = [...YOUTH_RATING_KEYS]
      .filter((key) => capped[key] > 1)
      .sort((left, right) => capped[right] - capped[left])[0];
    if (!strongestKey) break;
    capped[strongestKey] = roundYouthRating(capped[strongestKey] - 0.1);
  }

  return capped;
}
export function getYouthScoutingReportDetailLevel({
  scoutLevel,
  durationDays,
}: {
  scoutLevel: number;
  durationDays: number;
}) {
  const informationScore =
    clamp(Math.floor(scoutLevel), 1, 5) +
    (durationDays >= 5 ? 1 : 0) +
    (durationDays >= 7 ? 1 : 0);

  if (informationScore >= 7) return 3;
  if (informationScore >= 5) return 2;
  if (informationScore >= 3) return 1;
  return 0;
}

export function calculateYouthSigningCosts({
  potentialSteps,
  ratings,
  countryReputation,
}: {
  potentialSteps: number;
  ratings: YouthRatings;
  countryReputation: number;
}) {
  const average =
    YOUTH_RATING_KEYS.reduce((total, key) => total + ratings[key], 0) /
    YOUTH_RATING_KEYS.length;
  const signingFee = roundTo(
    1_500 + potentialSteps * 750 + average * 850 + countryReputation * 175,
    250,
  );
  const tuitionPerSeason = roundTo(
    3_000 + potentialSteps * 900 + average * 650,
    250,
  );
  return { signingFee, tuitionPerSeason };
}

export function chooseYouthArchetype({
  primary,
  secondary,
  random,
}: {
  primary: YouthArchetype;
  secondary: YouthArchetype;
  random: () => number;
}): YouthArchetype {
  const roll = random();
  if (roll < 0.56) return primary;
  if (roll < 0.82) return secondary;
  return roll < 0.94 ? "breakaway" : "all_rounder";
}

export function getScoutNationalityEfficiencyBonus(
  scoutCountryId: string,
  targetCountryId: string,
): number {
  return scoutCountryId === targetCountryId ? 15 : 0;
}

export function isYouthTrainingPriority(value: string): value is YouthTrainingDomain {
  return isYouthTrainingDomain(value);
}

export function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function roundYouthRating(value: number) {
  return Math.round(clamp(value, 1, 6) * 10) / 10;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
