import {
  getRiderBodyMassIndex,
  inferRiderPhysiologyProfile,
  RIDER_PHYSIOLOGY_PROFILE_REFERENCE,
  type RiderPhysiologyProfile,
} from "./rider-physiology";
import type { RiderRatings } from "./rider-profile";

// Sporting/gameplay warning thresholds, not medical BMI classifications.
// Use the simulation's natural specialty and morphology reference, not equipment
// bonuses or a leader/support role. Climbers have the smallest weight allowance.
const PROFILE_WEIGHT_WARNING: Record<RiderPhysiologyProfile, { label: string; bmiAllowance: number }> = {
  climber: { label: "Grimpeur", bmiAllowance: 0.5 },
  puncheur: { label: "Puncheur", bmiAllowance: 0.7 },
  stage_racer: { label: "Coureur de tour", bmiAllowance: 0.6 },
  northern_classics: { label: "Pavéman", bmiAllowance: 1 },
  rouleur: { label: "Rouleur", bmiAllowance: 1 },
  breakaway: { label: "Baroudeur", bmiAllowance: 0.8 },
  sprinter: { label: "Sprinteur", bmiAllowance: 1 },
  all_rounder: { label: "Polyvalent", bmiAllowance: 0.8 },
};

export type RiderWeightStatus = {
  profile: RiderPhysiologyProfile;
  profileLabel: string;
  bodyMassIndex: number;
  maximumBodyMassIndex: number;
  maximumWeightKg: number;
  isOverweight: boolean;
};

export type OverweightRiderSummary = {
  riderId: string;
  name: string;
  profileLabel: string;
  weightKg: number;
  maximumWeightKg: number;
};

export function getRiderWeightStatus({
  heightCm, weightKg, ratings,
}: {
  heightCm: number | null;
  weightKg: number | null;
  ratings: RiderRatings | null;
}): RiderWeightStatus | null {
  if (heightCm === null || weightKg === null || !ratings ||
      !Number.isFinite(heightCm) || !Number.isFinite(weightKg) ||
      heightCm < 145 || heightCm > 210 || weightKg < 40 || weightKg > 120 ||
      Object.values(ratings).some((rating) => !Number.isFinite(rating))) return null;

  const profile = inferRiderPhysiologyProfile(ratings);
  const reference = RIDER_PHYSIOLOGY_PROFILE_REFERENCE[profile];
  const warning = PROFILE_WEIGHT_WARNING[profile];
  const maximumBodyMassIndex = reference.weightKg / (reference.heightCm / 100) ** 2 + warning.bmiAllowance;
  // Persisted weights have one decimal: show the actual last permitted value.
  const maximumWeightKg = Math.floor(maximumBodyMassIndex * (heightCm / 100) ** 2 * 10) / 10;
  return {
    profile,
    profileLabel: warning.label,
    bodyMassIndex: getRiderBodyMassIndex({ heightCm, weightKg })!,
    maximumBodyMassIndex: Math.round(maximumBodyMassIndex * 100) / 100,
    maximumWeightKg,
    isOverweight: weightKg > maximumWeightKg + 1e-9,
  };
}

export function getRiderWeightStatusLabel(status: RiderWeightStatus): string {
  const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return `${status.isOverweight ? "Surpoids pour le profil" : "Profil"} ${status.profileLabel} · IMC ${number(status.bodyMassIndex)} · seuil de poids ${number(status.maximumWeightKg)} kg`;
}
