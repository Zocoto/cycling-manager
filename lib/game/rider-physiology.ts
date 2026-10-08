import type { RaceProfileType } from "./race-calendar";
import type {
  RiderSimulationRatings,
} from "./race-simulation";

export type RiderPhysiology = {
  heightCm: number;
  weightKg: number;
  baselineWeightKg: number;
  physiologyVersion: number;
  // Locked before race-day/equipment adjustments so warning and simulation
  // keep the same natural profile throughout a race.
  naturalProfile?: RiderPhysiologyProfile;
};

export type RiderPhysiologyProfile =
  | "climber"
  | "puncheur"
  | "stage_racer"
  | "northern_classics"
  | "rouleur"
  | "breakaway"
  | "sprinter"
  | "all_rounder";

type TerrainPhysiologyContext = {
  terrain: "flat" | "climb" | "descent";
  surface: "asphalt" | "cobbles" | "gravel";
  distanceKm: number;
  averageGradientPct: number;
};

export const RIDER_PHYSIOLOGY_PROFILE_REFERENCE: Record<
  RiderPhysiologyProfile,
  { heightCm: number; weightKg: number }
> = {
  climber: { heightCm: 170, weightKg: 59 },
  puncheur: { heightCm: 175, weightKg: 66 },
  stage_racer: { heightCm: 176, weightKg: 65 },
  northern_classics: { heightCm: 182, weightKg: 76 },
  rouleur: { heightCm: 183, weightKg: 74 },
  breakaway: { heightCm: 176, weightKg: 66 },
  sprinter: { heightCm: 181, weightKg: 77 },
  all_rounder: { heightCm: 177, weightKg: 68 },
};

// Sporting/gameplay thresholds, not medical BMI classifications.
export const RIDER_PHYSIOLOGY_WEIGHT_LIMITS: Record<
  RiderPhysiologyProfile,
  { label: string; bmiAllowance: number }
> = {
  climber: { label: "Grimpeur", bmiAllowance: 0.5 },
  puncheur: { label: "Puncheur", bmiAllowance: 0.7 },
  stage_racer: { label: "Coureur de tour", bmiAllowance: 0.6 },
  northern_classics: { label: "Pavéman", bmiAllowance: 1 },
  rouleur: { label: "Rouleur", bmiAllowance: 1 },
  breakaway: { label: "Baroudeur", bmiAllowance: 0.8 },
  sprinter: { label: "Sprinteur", bmiAllowance: 1 },
  all_rounder: { label: "Polyvalent", bmiAllowance: 0.8 },
};

export const RIDER_OVERWEIGHT_BONUS_FADE_BMI = 2;
export const RIDER_POWER_UNDERWEIGHT_BMI_ALLOWANCE = 1;
export const RIDER_POWER_PROFILES: RiderPhysiologyProfile[] = ["rouleur", "northern_classics", "sprinter"];
export const RIDER_OVERWEIGHT_RULES = {
  cobbles: { label: "Pavés", penaltyPerBmi: 0.6, maximumPenalty: 3 },
  flat: { label: "Plat / sprint", penaltyPerBmi: 0.8, maximumPenalty: 4 },
  time_trial: { label: "CLM", penaltyPerBmi: 1, maximumPenalty: 4 },
} as const;
type OverweightTerrain = keyof typeof RIDER_OVERWEIGHT_RULES;

export function getRiderWeightThreshold(profile: RiderPhysiologyProfile, heightCm: number) {
  const reference = RIDER_PHYSIOLOGY_PROFILE_REFERENCE[profile];
  const warning = RIDER_PHYSIOLOGY_WEIGHT_LIMITS[profile];
  const maximumBodyMassIndex = reference.weightKg / (reference.heightCm / 100) ** 2 + warning.bmiAllowance;
  const maximumWeightKg = Math.floor(maximumBodyMassIndex * (heightCm / 100) ** 2 * 10) / 10;
  return { maximumBodyMassIndex, maximumWeightKg, profileLabel: warning.label };
}

export function getRiderMinimumPowerWeight(profile: RiderPhysiologyProfile, heightCm: number) {
  if (!RIDER_POWER_PROFILES.includes(profile)) return null;
  const reference = RIDER_PHYSIOLOGY_PROFILE_REFERENCE[profile];
  const referenceBmi = reference.weightKg / (reference.heightCm / 100) ** 2;
  const minimumBodyMassIndex = referenceBmi - RIDER_POWER_UNDERWEIGHT_BMI_ALLOWANCE;
  return {
    minimumBodyMassIndex,
    minimumWeightKg: Math.ceil(minimumBodyMassIndex * (heightCm / 100) ** 2 * 10 - 1e-9) / 10,
    typicalWeightKg: Math.round(referenceBmi * (heightCm / 100) ** 2 * 10) / 10,
  };
}

export function inferRiderPhysiologyProfile(
  ratings: RiderSimulationRatings,
): RiderPhysiologyProfile {
  const scores: Array<[RiderPhysiologyProfile, number]> = [
    ["climber", ratings.mountain * 1.08 + ratings.endurance * 0.18],
    ["puncheur", ratings.hills * 1.06 + ratings.acceleration * 0.2],
    [
      "stage_racer",
      ratings.mountain * 0.52 +
        ratings.hills * 0.26 +
        ratings.timeTrial * 0.16 +
        ratings.recovery * 0.12,
    ],
    [
      "northern_classics",
      ratings.cobbles * 1.08 + ratings.resistance * 0.2,
    ],
    ["rouleur", ratings.timeTrial * 0.68 + ratings.flat * 0.42],
    ["breakaway", ratings.breakaway * 1.02 + ratings.endurance * 0.18],
    ["sprinter", ratings.sprint * 1.08 + ratings.acceleration * 0.2],
  ];
  const [profile] = scores.sort(
    (left, right) => right[1] - left[1],
  )[0];
  return profile;
}

/**
 * Returns the rating-equivalent effect of a rider's physique. Legacy riders
 * start neutral (version 0), but later weight changes still matter. New
 * riders also receive their small intrinsic morphology effect. Excess BMI
 * fades positive power/stability bonuses and eventually penalizes all riders.
 */
export function getRiderPhysiologyProfileModifier({
  physiology,
  ratings,
  profileType,
}: {
  physiology?: RiderPhysiology | null;
  ratings: RiderSimulationRatings;
  profileType: RaceProfileType;
}) {
  if (!isUsablePhysiology(physiology)) return 0;
  const reference = getReference(physiology, ratings);
  const massDelta = physiology.weightKg - reference.weightKg;
  const heightDelta = physiology.heightCm - reference.heightCm;

  if (profileType === "mountain") {
    return clamp(-massDelta * 0.62 - heightDelta * 0.025, -4.5, 4.5);
  }
  if (profileType === "hilly") {
    return clamp(-massDelta * 0.36 - heightDelta * 0.012, -3, 3);
  }
  if (profileType === "cobbles") {
    return getPowerTerrainModifier(physiology, ratings, reference, "cobbles", 0.2, 0.035, 2.2);
  }
  if (profileType === "sprint" || profileType === "flat") {
    return getPowerTerrainModifier(physiology, ratings, reference, "flat", 0.14, 0.025, 1.8);
  }
  if (profileType === "time_trial") {
    return getPowerTerrainModifier(physiology, ratings, reference, "time_trial", 0.08, 0.035, 1.6);
  }
  return clamp(-massDelta * 0.12 + heightDelta * 0.008, -1.5, 1.5);
}

export function getRiderPhysiologyTerrainModifier({
  physiology,
  ratings,
  segment,
}: {
  physiology?: RiderPhysiology | null;
  ratings: RiderSimulationRatings;
  segment: TerrainPhysiologyContext;
}) {
  if (!isUsablePhysiology(physiology)) return 0;
  const reference = getReference(physiology, ratings);
  const massDelta = physiology.weightKg - reference.weightKg;
  const heightDelta = physiology.heightCm - reference.heightCm;

  if (segment.surface === "cobbles" || segment.surface === "gravel") {
    const roughness = segment.surface === "cobbles" ? 1 : 0.68;
    // Retain the existing surface multiplier; both positive stability and
    // excess-weight penalties are weaker on gravel than on cobbles.
    return getPowerTerrainModifier(physiology, ratings, reference, "cobbles", 0.2 * roughness, 0.035 * roughness, 2.2, roughness);
  }
  if (segment.terrain === "climb") {
    const difficulty = clamp(
      0.62 +
        Math.abs(segment.averageGradientPct) / 14 +
        Math.min(18, segment.distanceKm) / 45,
      0.7,
      1.45,
    );
    return clamp(
      (-massDelta * 0.56 - heightDelta * 0.022) * difficulty,
      -4.5,
      4.5,
    );
  }
  if (segment.terrain === "descent") {
    return clamp(massDelta * 0.1 + heightDelta * 0.012, -1.2, 1.2);
  }
  return getPowerTerrainModifier(physiology, ratings, reference, "flat", 0.07, 0.015, 1);
}

function getPowerTerrainModifier(
  physiology: RiderPhysiology,
  ratings: RiderSimulationRatings,
  reference: { heightCm: number; weightKg: number },
  terrain: OverweightTerrain,
  massCoefficient: number,
  heightCoefficient: number,
  currentCap: number,
  penaltyMultiplier = 1,
) {
  const profile = physiology.naturalProfile ?? inferRiderPhysiologyProfile(ratings);
  const { maximumBodyMassIndex } = getRiderWeightThreshold(profile, physiology.heightCm);
  const heightSquared = (physiology.heightCm / 100) ** 2;
  const excessBmi = physiology.weightKg / heightSquared - maximumBodyMassIndex;
  const currentModifier = clamp(
    (physiology.weightKg - reference.weightKg) * massCoefficient +
      (physiology.heightCm - reference.heightCm) * heightCoefficient,
    -currentCap, currentCap,
  );
  if (profile === "rouleur" || profile === "northern_classics" || profile === "sprinter") {
    // Reuse the already computed BMI delta in this hot sector-by-sector path;
    // avoid another profile lookup, exponentiation and temporary object.
    const deficitBmi = -excessBmi - RIDER_PHYSIOLOGY_WEIGHT_LIMITS[profile].bmiAllowance -
      RIDER_POWER_UNDERWEIGHT_BMI_ALLOWANCE;
    if (deficitBmi > 0) {
      const rule = RIDER_OVERWEIGHT_RULES[terrain];
      return clamp(
        Math.min(0, currentModifier) + Math.max(0, currentModifier) * Math.max(0, 1 - deficitBmi) -
          Math.min(rule.maximumPenalty, deficitBmi * rule.penaltyPerBmi) * penaltyMultiplier,
        -Math.max(currentCap, rule.maximumPenalty * penaltyMultiplier), currentCap,
      );
    }
  }
  if (excessBmi <= 0) return currentModifier;

  // Freeze the bonus at the exact threshold before fading it. Multiplying
  // the bonus at the current weight would still reward some further gains.
  const thresholdModifier = clamp(
    (maximumBodyMassIndex * heightSquared - reference.weightKg) * massCoefficient +
      (physiology.heightCm - reference.heightCm) * heightCoefficient,
    -currentCap, currentCap,
  );
  const retainedBonus = Math.max(0, thresholdModifier) *
    Math.max(0, 1 - excessBmi / RIDER_OVERWEIGHT_BONUS_FADE_BMI);
  const rule = RIDER_OVERWEIGHT_RULES[terrain];
  const excessPenalty = Math.min(
    rule.maximumPenalty,
    Math.max(0, excessBmi - RIDER_OVERWEIGHT_BONUS_FADE_BMI) * rule.penaltyPerBmi,
  ) * penaltyMultiplier;
  // Never turn an existing negative modifier into a bonus or erase it.
  // Keep the maximum a bound on this modifier, not an extra additive tax.
  return clamp(
    Math.min(0, currentModifier, thresholdModifier) + retainedBonus - excessPenalty,
    -Math.max(currentCap, rule.maximumPenalty * penaltyMultiplier), currentCap,
  );
}

export function getRiderBodyMassIndex({
  heightCm,
  weightKg,
}: Pick<RiderPhysiology, "heightCm" | "weightKg">) {
  if (heightCm <= 0 || weightKg <= 0) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

function getReference(
  physiology: RiderPhysiology,
  ratings: RiderSimulationRatings,
) {
  if (physiology.physiologyVersion <= 0) {
    return {
      heightCm: physiology.heightCm,
      weightKg: physiology.baselineWeightKg,
    };
  }
  return RIDER_PHYSIOLOGY_PROFILE_REFERENCE[
    physiology.naturalProfile ?? inferRiderPhysiologyProfile(ratings)
  ];
}

function isUsablePhysiology(
  physiology?: RiderPhysiology | null,
): physiology is RiderPhysiology {
  return Boolean(
    physiology &&
      Number.isFinite(physiology.heightCm) &&
      Number.isFinite(physiology.weightKg) &&
      Number.isFinite(physiology.baselineWeightKg) &&
      physiology.heightCm >= 145 &&
      physiology.weightKg >= 40,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  const clamped = Math.min(maximum, Math.max(minimum, value));
  return Object.is(clamped, -0) ? 0 : clamped;
}
