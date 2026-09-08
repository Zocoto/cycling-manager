import { getInfrastructureSpecializationPowerPercentage } from "./infrastructure-specializations";

export const FAN_CLUB_HEADQUARTERS_SPECIALIZATION_CODES = [
  "recruitment_campaigns",
  "loyalty_program",
  "event_house",
] as const;

export type FanClubHeadquartersSpecializationCode =
  (typeof FAN_CLUB_HEADQUARTERS_SPECIALIZATION_CODES)[number];

export type FanClubHeadquartersSpecialization = {
  code: FanClubHeadquartersSpecializationCode;
  infrastructureLevel: number;
};

export function isFanClubHeadquartersSpecializationCode(
  value: string | null | undefined,
): value is FanClubHeadquartersSpecializationCode {
  return FAN_CLUB_HEADQUARTERS_SPECIALIZATION_CODES.includes(
    value as FanClubHeadquartersSpecializationCode,
  );
}

export function getFanClubHeadquartersSpecializationEffects(
  specialization: FanClubHeadquartersSpecialization | null | undefined,
) {
  const power = specialization
    ? getInfrastructureSpecializationPowerPercentage(
        specialization.infrastructureLevel,
      ) / 100
    : 0;
  return {
    supporterGrowthBonusPercentage:
      specialization?.code === "recruitment_campaigns" ? 8 * power : 0,
    homeVictorySupporterBonusPercentage:
      specialization?.code === "recruitment_campaigns" ? 5 * power : 0,
    carCapacityBonusPercentage:
      specialization?.code === "loyalty_program" ? 10 * power : 0,
    carPurchaseDiscountPercentage:
      specialization?.code === "loyalty_program" ? 5 * power : 0,
    fervorGainBonusPercentage:
      specialization?.code === "event_house" ? 5 * power : 0,
    riderPopularityGainBonusPercentage:
      specialization?.code === "event_house" ? 3 * power : 0,
  };
}
