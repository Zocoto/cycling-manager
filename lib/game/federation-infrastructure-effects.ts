import type { FederationInfrastructureCode } from "@/lib/game/federation-infrastructures";
import { getInfrastructureSpecializationPowerPercentage } from "@/lib/game/infrastructure-specializations";
import type { RiderRatingKey } from "@/lib/game/rider-profile";
import type { StaffRole } from "@/lib/game/staff";

export type NationalDetectionNetworkSpecializationCode =
  | "territorial_coverage"
  | "elite_detection"
  | "profile_diversity";

export type NationalPerformanceCenterSpecializationCode =
  | "altitude_endurance"
  | "speed_power"
  | "rolling_engine";

export type FederalStaffInstituteSpecializationCode =
  | "coach_school"
  | "scout_school"
  | "medical_school";

export type FederalMedicalNetworkSpecializationCode =
  | "emergency_network"
  | "rehab_network"
  | "prevention_network";

export type FederalMedicalNetworkEffects = {
  injuryRiskReductionPercentage: number;
  moderateInjuryAbandonmentRiskReductionPercentage: number;
  medicalProtocolCostReductionPercentage: number;
  moderateInjuryRecoveryReductionPercentage: number;
  injuryFormLossReductionPercentage: number;
  restFormGainPercentage: number;
};

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

export function isFederalStaffInstituteSpecializationCode(
  value: unknown,
): value is FederalStaffInstituteSpecializationCode {
  return (
    value === "coach_school" ||
    value === "scout_school" ||
    value === "medical_school"
  );
}

export function isFederalMedicalNetworkSpecializationCode(
  value: unknown,
): value is FederalMedicalNetworkSpecializationCode {
  return (
    value === "emergency_network" ||
    value === "rehab_network" ||
    value === "prevention_network"
  );
}

export function getFederalMedicalNetworkEffects({
  level,
  specializationCode,
}: {
  level: number;
  specializationCode: FederalMedicalNetworkSpecializationCode | null;
}): FederalMedicalNetworkEffects {
  const power =
    getInfrastructureSpecializationPowerPercentage(
      normalizeFederationInfrastructureLevel(level),
      "federal_medical_network",
    ) / 100;
  const applies = (code: FederalMedicalNetworkSpecializationCode) =>
    specializationCode === code && power > 0;
  const scaled = (maximum: number) =>
    Math.round(maximum * power * 10) / 10;

  return {
    injuryRiskReductionPercentage: applies("prevention_network")
      ? scaled(5)
      : 0,
    moderateInjuryAbandonmentRiskReductionPercentage: applies(
      "emergency_network",
    )
      ? scaled(8)
      : 0,
    medicalProtocolCostReductionPercentage: applies("emergency_network")
      ? scaled(4)
      : 0,
    moderateInjuryRecoveryReductionPercentage: applies("rehab_network")
      ? scaled(6)
      : 0,
    injuryFormLossReductionPercentage: applies("rehab_network")
      ? scaled(4)
      : 0,
    restFormGainPercentage: applies("prevention_network") ? scaled(4) : 0,
  };
}

export function getFederalStaffInstituteSpecializationBonusPercentage({
  level,
  specializationCode,
  role,
}: {
  level: number;
  specializationCode: FederalStaffInstituteSpecializationCode | null;
  role: StaffRole;
}): number {
  if (!specializationCode) return 0;

  const power =
    getInfrastructureSpecializationPowerPercentage(
      normalizeFederationInfrastructureLevel(level),
      "federal_staff_institute",
    ) / 100;
  if (power <= 0) return 0;

  const roleMatches =
    (specializationCode === "coach_school" && role === "trainer") ||
    (specializationCode === "scout_school" && role === "scout") ||
    (specializationCode === "medical_school" &&
      (role === "doctor" ||
        role === "physiotherapist" ||
        role === "nutritionist"));

  return roleMatches ? Math.round(3 * power * 10) / 10 : 0;
}

export function getFederalStaffInstituteBonusPercentage({
  level,
  specializationCode,
  role,
  isNationalStaff,
}: {
  level: number;
  specializationCode: FederalStaffInstituteSpecializationCode | null;
  role: StaffRole;
  isNationalStaff: boolean;
}): number {
  if (!isNationalStaff) return 0;

  return (
    getFederationInfrastructureEffectPercentage(
      "federal_staff_institute",
      level,
    ) +
    getFederalStaffInstituteSpecializationBonusPercentage({
      level,
      specializationCode,
      role,
    })
  );
}

export function getFederalStaffAcademyDurationReductionPercentage({
  level,
  specializationCode,
  role,
  isNationalStaff,
}: {
  level: number;
  specializationCode: FederalStaffInstituteSpecializationCode | null;
  role: StaffRole;
  isNationalStaff: boolean;
}): number {
  if (!isNationalStaff) return 0;

  const affectsTraining =
    (specializationCode === "coach_school" && role === "trainer") ||
    (specializationCode === "medical_school" &&
      (role === "doctor" ||
        role === "physiotherapist" ||
        role === "nutritionist"));
  if (!affectsTraining) return 0;

  const power =
    getInfrastructureSpecializationPowerPercentage(
      normalizeFederationInfrastructureLevel(level),
      "federal_staff_institute",
    ) / 100;
  return Math.round(5 * power * 10) / 10;
}

export function getFederalScoutReportPrecisionBonusPercentage({
  level,
  specializationCode,
  isNationalStaff,
}: {
  level: number;
  specializationCode: FederalStaffInstituteSpecializationCode | null;
  isNationalStaff: boolean;
}): number {
  if (!isNationalStaff || specializationCode !== "scout_school") return 0;

  const power =
    getInfrastructureSpecializationPowerPercentage(
      normalizeFederationInfrastructureLevel(level),
      "federal_staff_institute",
    ) / 100;
  return Math.round(5 * power * 10) / 10;
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
