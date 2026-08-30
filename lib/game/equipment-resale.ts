import type { EquipmentEffects } from "@/lib/game/equipment";

export type EquipmentRarity = "common" | "performance" | "premium";

const RARITY_FLOORS: Record<EquipmentRarity, number> = {
  common: 400,
  performance: 1_000,
  premium: 2_500,
};

export function calculateEquipmentResalePrice({
  purchasePrice,
  rarity,
  effects,
}: {
  purchasePrice: number;
  rarity: EquipmentRarity;
  effects: EquipmentEffects;
}) {
  if (purchasePrice > 0) {
    return roundToHundred(Math.max(100, purchasePrice * 0.5));
  }

  const ratingPower = [
    ...Object.values(effects.ratingBonuses),
    ...Object.values(effects.timeTrialRatingBonuses),
  ].reduce((total, value) => total + Math.max(0, value ?? 0), 0);
  const effectValue =
    ratingPower * 400 +
    Math.max(0, effects.injuryRiskReductionPct) * 50 +
    Math.max(
      0,
      effects.breakawayReputationBonus + effects.victoryReputationBonus,
    ) *
      4_000;

  return roundToHundred(
    Math.max(100, RARITY_FLOORS[rarity], effectValue),
  );
}

export function calculateResearchPrototypeResalePrice({
  effects,
}: {
  effects: EquipmentEffects;
}) {
  const signedRatingPower = [
    ...Object.values(effects.ratingBonuses),
    ...Object.values(effects.timeTrialRatingBonuses),
  ].reduce((total, value) => total + (value ?? 0), 0);
  const effectValue =
    5_000 +
    signedRatingPower * 1_000 +
    effects.injuryRiskReductionPct * 50 +
    (effects.breakawayReputationBonus + effects.victoryReputationBonus) *
      4_000;

  return roundToHundred(Math.max(100, effectValue));
}

function roundToHundred(value: number) {
  return Math.round(value / 100) * 100;
}
