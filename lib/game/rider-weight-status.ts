import {
  getRiderBodyMassIndex,
  getRiderWeightThreshold,
  getRiderMinimumPowerWeight,
  inferRiderPhysiologyProfile,
  RIDER_OVERWEIGHT_BONUS_FADE_BMI,
  type RiderPhysiologyProfile,
} from "./rider-physiology";
import type { RiderRatings } from "./rider-profile";

export type RiderOverweightPhase = "none" | "reduced_bonus" | "penalty";

export type RiderWeightStatus = {
  profile: RiderPhysiologyProfile;
  profileLabel: string;
  bodyMassIndex: number;
  maximumBodyMassIndex: number;
  maximumWeightKg: number;
  isOverweight: boolean;
  overweightPhase: RiderOverweightPhase;
  isUnderweight: boolean;
  minimumWeightKg: number | null;
  minimumBodyMassIndex: number | null;
};

export type OverweightRiderSummary = {
  riderId: string;
  name: string;
  profileLabel: string;
  weightKg: number;
  maximumWeightKg: number;
  overweightPhase?: RiderOverweightPhase;
  isUnderweight?: boolean;
  minimumWeightKg?: number;
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
  const { maximumBodyMassIndex, maximumWeightKg, profileLabel } = getRiderWeightThreshold(profile, heightCm);
  const isOverweight = weightKg > maximumWeightKg + 1e-9;
  const minimum = getRiderMinimumPowerWeight(profile, heightCm);
  const overweightPhase: RiderOverweightPhase = !isOverweight ? "none" :
    weightKg / (heightCm / 100) ** 2 >= maximumBodyMassIndex + RIDER_OVERWEIGHT_BONUS_FADE_BMI
      ? "penalty" : "reduced_bonus";
  return {
    profile,
    profileLabel,
    bodyMassIndex: getRiderBodyMassIndex({ heightCm, weightKg })!,
    maximumBodyMassIndex: Math.round(maximumBodyMassIndex * 100) / 100,
    maximumWeightKg,
    isOverweight,
    overweightPhase,
    isUnderweight: minimum !== null && weightKg < minimum.minimumWeightKg - 1e-9,
    minimumWeightKg: minimum?.minimumWeightKg ?? null,
    minimumBodyMassIndex: minimum?.minimumBodyMassIndex ?? null,
  };
}

export function getRiderWeightStatusLabel(status: RiderWeightStatus): string {
  const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (status.isUnderweight) return `Sous-poids pour le profil ${status.profileLabel} · IMC ${number(status.bodyMassIndex)} · poids minimal ${number(status.minimumWeightKg!)} kg · manque de puissance sur pavés, plat/sprint et CLM`;
  const impact = status.overweightPhase === "penalty" ? " · malus sur pavés, plat/sprint et CLM" :
    status.overweightPhase === "reduced_bonus" ? " · bonus réduit sur pavés, plat/sprint et CLM" : "";
  return `${status.isOverweight ? "Surpoids pour le profil" : "Profil"} ${status.profileLabel} · IMC ${number(status.bodyMassIndex)} · seuil de poids ${number(status.maximumWeightKg)} kg${impact}`;
}
