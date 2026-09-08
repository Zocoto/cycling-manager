import type { FederationInfrastructureCode } from "@/lib/game/federation-infrastructures";
import { getInfrastructureSpecializationPowerPercentage } from "@/lib/game/infrastructure-specializations";

export type NationalDetectionNetworkSpecializationCode =
  | "territorial_coverage"
  | "elite_detection"
  | "profile_diversity";

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
  regional_academies: 1,
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
