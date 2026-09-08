import type { FederationInfrastructureCode } from "@/lib/game/federation-infrastructures";
import { getInfrastructureSpecializationPowerPercentage } from "@/lib/game/infrastructure-specializations";
import type { RiderRatingKey } from "@/lib/game/rider-profile";

export type NationalDetectionNetworkSpecializationCode =
  | "territorial_coverage"
  | "elite_detection"
  | "profile_diversity";

export type NationalPerformanceCenterSpecializationCode =
  | "altitude_endurance"
  | "speed_power"
  | "rolling_engine";

export const NATIONAL_DETECTION_NETWORK_ATYPICAL_STYLE_BONUS_PERCENTAGE = 2;

export type NationalDetectionNetworkEffects = {
  additionalCandidateChance: number;
  reportPrecisionBonusPercentage: number;
  elitePotentialRelativeBonusPercentage: number;
  potentialPrecisionBonusPercentage: number;
  atypicalStyleRelativeBonusPercentage: number;
};

export const FEDERATION_INFRASTRUCTURE_EFFECT_PER_LEVEL = {
  national_detection_network: 1,
  national_performance_center: 0.3,
  federal_staff_institute: 0.5,
  federal_medical_network: 1,
  national_technical_laboratory: 0.2,
  race_organization_office: 5,
  federal_integration_office: 4,
  home_advantage_program: 0.2,
} as const satisfies Record<FederationInfrastructureCode, number>;

export function normalizeFederationInfrastructureLevel(level: number): number {
  return Math.min(5, Math.max(0, Math.trunc(Number.isFinite(level) ? level : 0)));
}

export function getFederationInfrastructureEffectPercentage(
  code: FederationInfrastructureCode,
  level: number,
): number {
  return (
    normalizeFederationInfrastructureLevel(level) *
    FEDERATION_INFRASTRUCTURE_EFFECT_PER_LEVEL[code]
  );
}

export function getNationalDetectionNetworkEffects({
  level,
  specializationCode,
}: {
  level: number;
  specializationCode: string | null;
}): NationalDetectionNetworkEffects {
  const normalizedLevel = normalizeFederationInfrastructureLevel(level);
  const specializationPower =
    getInfrastructureSpecializationPowerPercentage(
      normalizedLevel,
      "national_detection_network",
    ) / 100;
  const hasSpecialization = (
    code: NationalDetectionNetworkSpecializationCode,
  ) => specializationCode === code && specializationPower > 0;

  return {
    additionalCandidateChance: hasSpecialization("territorial_coverage")
      ? specializationPower
      : 0,
    reportPrecisionBonusPercentage: hasSpecialization("territorial_coverage")
      ? 4 * specializationPower
      : 0,
    elitePotentialRelativeBonusPercentage: hasSpecialization(
      "elite_detection",
    )
      ? 3 * specializationPower
      : 0,
    potentialPrecisionBonusPercentage: hasSpecialization("elite_detection")
      ? 5 * specializationPower
      : 0,
    atypicalStyleRelativeBonusPercentage:
      (normalizedLevel >= 3
        ? NATIONAL_DETECTION_NETWORK_ATYPICAL_STYLE_BONUS_PERCENTAGE
        : 0) +
      (hasSpecialization("profile_diversity")
        ? 10 * specializationPower
        : 0),
  };
}

export function isNationalPerformanceCenterSpecializationCode(
  value: unknown,
): value is NationalPerformanceCenterSpecializationCode {
  return (
    value === "altitude_endurance" ||
    value === "speed_power" ||
    value === "rolling_engine"
  );
}

export function getNationalPerformanceCenterSpecializationBonusPercentage({
  level,
  specializationCode,
  ratingKey,
}: {
  level: number;
  specializationCode: NationalPerformanceCenterSpecializationCode | null;
  ratingKey: RiderRatingKey;
}): number {
  if (!specializationCode) return 0;

  const power =
    getInfrastructureSpecializationPowerPercentage(
      normalizeFederationInfrastructureLevel(level),
      "national_performance_center",
    ) / 100;
  if (power <= 0) return 0;

  const isPrimary =
    (specializationCode === "altitude_endurance" &&
      (ratingKey === "mountain" || ratingKey === "endurance")) ||
    (specializationCode === "speed_power" &&
      (ratingKey === "sprint" || ratingKey === "acceleration")) ||
    (specializationCode === "rolling_engine" &&
      (ratingKey === "timeTrial" || ratingKey === "flat"));
  if (isPrimary) return Math.round(1.5 * power * 10) / 10;

  const isSecondary =
    (specializationCode === "altitude_endurance" &&
      ratingKey === "recovery") ||
    (specializationCode === "speed_power" && ratingKey === "prologue") ||
    (specializationCode === "rolling_engine" &&
      ratingKey === "resistance");
  return isSecondary ? Math.round(0.5 * power * 10) / 10 : 0;
}

export function getFederationNaturalizationRequiredDays({
  level,
  baseDays,
}: {
  level: number;
  baseDays: number;
}): number {
  const reduction = getFederationInfrastructureEffectPercentage(
    "federal_integration_office",
    level,
  );
  return Math.max(0, Math.ceil(baseDays * (1 - reduction / 100)));
}

export function getBestNaturalizationRequiredDays({
  teamRequiredDays,
  federalIntegrationLevel,
  baseDays,
}: {
  teamRequiredDays: number;
  federalIntegrationLevel: number;
  baseDays: number;
}): number {
  return Math.min(
    Math.max(0, Math.trunc(teamRequiredDays)),
    getFederationNaturalizationRequiredDays({
      level: federalIntegrationLevel,
      baseDays,
    }),
  );
}
