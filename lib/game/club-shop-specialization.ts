import { getInfrastructureSpecializationPowerPercentage } from "./infrastructure-specializations";

export const CLUB_SHOP_SPECIALIZATION_CODES = [
  "volume_retail",
  "premium_retail",
  "limited_editions",
] as const;

export type ClubShopSpecializationCode =
  (typeof CLUB_SHOP_SPECIALIZATION_CODES)[number];

export type ClubShopSpecialization = {
  code: ClubShopSpecializationCode;
  infrastructureLevel: number;
};

export type ClubShopSpecializationEffects = {
  salesVolumeBonusPercentage: number;
  acceptedMarginBonusPercentage: number;
  prolificDayChanceBonusPoints: number;
  wholesaleCostReductionPercentage: number;
};

export function isClubShopSpecializationCode(
  value: string | null | undefined,
): value is ClubShopSpecializationCode {
  return CLUB_SHOP_SPECIALIZATION_CODES.includes(
    value as ClubShopSpecializationCode,
  );
}

export function getClubShopSpecializationEffects(
  specialization?: ClubShopSpecialization | null,
): ClubShopSpecializationEffects {
  const effects: ClubShopSpecializationEffects = {
    salesVolumeBonusPercentage: 0,
    acceptedMarginBonusPercentage: 0,
    prolificDayChanceBonusPoints: 0,
    wholesaleCostReductionPercentage: 0,
  };
  if (!specialization) return effects;

  const power =
    getInfrastructureSpecializationPowerPercentage(
      specialization.infrastructureLevel,
    ) / 100;

  if (specialization.code === "volume_retail") {
    effects.salesVolumeBonusPercentage = roundPercentage(10 * power);
  } else if (specialization.code === "premium_retail") {
    effects.acceptedMarginBonusPercentage = roundPercentage(8 * power);
  } else if (specialization.code === "limited_editions") {
    effects.prolificDayChanceBonusPoints = roundPercentage(10 * power);
    effects.wholesaleCostReductionPercentage = roundPercentage(5 * power);
  }

  return effects;
}

export function getClubShopEffectiveDemandPrice({
  salePrice,
  specialization,
}: {
  salePrice: number;
  specialization?: ClubShopSpecialization | null;
}): number {
  const { acceptedMarginBonusPercentage } =
    getClubShopSpecializationEffects(specialization);
  return salePrice / (1 + acceptedMarginBonusPercentage / 100);
}

export function applyClubShopWholesaleDiscount({
  unitCost,
  specialization,
}: {
  unitCost: number;
  specialization?: ClubShopSpecialization | null;
}): number {
  const { wholesaleCostReductionPercentage } =
    getClubShopSpecializationEffects(specialization);
  return roundCurrency(
    unitCost * (1 - wholesaleCostReductionPercentage / 100),
  );
}

function roundPercentage(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
