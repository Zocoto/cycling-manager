import {
  getInfrastructureSpecializationPowerPercentage,
} from "./infrastructure-specializations";
import {
  getRiderRatingImportance,
  type RiderRatingKey,
} from "./rider-profile";

export const TRAINING_CENTER_SPECIALIZATION_CODES = [
  "individualization",
  "elite_performance",
  "durability",
] as const;

export type TrainingCenterSpecializationCode =
  (typeof TRAINING_CENTER_SPECIALIZATION_CODES)[number];

export type TrainingCenterSpecialization = {
  code: TrainingCenterSpecializationCode;
  infrastructureLevel: number;
};

export function isTrainingCenterSpecializationCode(
  value: string | null | undefined,
): value is TrainingCenterSpecializationCode {
  return TRAINING_CENTER_SPECIALIZATION_CODES.includes(
    value as TrainingCenterSpecializationCode,
  );
}

export function getTrainingCenterSpecializationProgressBonusPercentage({
  specialization,
  ratingKey,
  currentRating,
  trainerCountryMatch = false,
}: {
  specialization?: TrainingCenterSpecialization | null;
  ratingKey: RiderRatingKey;
  currentRating: number;
  trainerCountryMatch?: boolean;
}): number {
  if (!specialization) return 0;

  let fullPowerBonus = 0;

  if (specialization.code === "individualization") {
    if (currentRating < 70) fullPowerBonus += 5;
    if (
      currentRating < 65 &&
      getRiderRatingImportance(ratingKey) === "secondary"
    ) {
      fullPowerBonus += 5;
    }
  } else if (specialization.code === "elite_performance") {
    if (currentRating >= 75 && currentRating <= 82) fullPowerBonus += 2;
    if (trainerCountryMatch) fullPowerBonus += 5;
  }

  return roundPercentage(
    fullPowerBonus *
      (getInfrastructureSpecializationPowerPercentage(
        specialization.infrastructureLevel,
      ) /
        100),
  );
}

export function getSkippedLowFormRecoveryGain({
  specialization,
  baseGain = 2,
}: {
  specialization?: TrainingCenterSpecialization | null;
  baseGain?: number;
}): number {
  if (!specialization || specialization.code !== "durability") {
    return baseGain;
  }

  return roundPercentage(
    baseGain +
      getInfrastructureSpecializationPowerPercentage(
        specialization.infrastructureLevel,
      ) /
        100,
  );
}

function roundPercentage(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
