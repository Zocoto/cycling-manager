import type { RaceProfileType } from "./race-calendar";
import type {
  RiderSimulationRatings,
} from "./race-simulation";

export type RiderPhysiology = {
  heightCm: number;
  weightKg: number;
  baselineWeightKg: number;
  physiologyVersion: number;
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
 * riders also receive their small intrinsic morphology effect.
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
    return clamp(massDelta * 0.2 + heightDelta * 0.035, -2.2, 2.2);
  }
  if (profileType === "sprint" || profileType === "flat") {
    return clamp(massDelta * 0.14 + heightDelta * 0.025, -1.8, 1.8);
  }
  if (profileType === "time_trial") {
    return clamp(massDelta * 0.08 + heightDelta * 0.035, -1.6, 1.6);
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
    return clamp(
      (massDelta * 0.2 + heightDelta * 0.035) * roughness,
      -2.2,
      2.2,
    );
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
  return clamp(massDelta * 0.07 + heightDelta * 0.015, -1, 1);
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
  return RIDER_PHYSIOLOGY_PROFILE_REFERENCE[inferRiderPhysiologyProfile(ratings)];
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
