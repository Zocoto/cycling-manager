import {
  NUTRITION_INTERVENTIONS,
  getNutritionInterventionOutcome,
  type NutritionInterventionCode,
} from "./health-center";

export type NutritionistInterventionOption = {
  contractId: string;
  name: string;
  level: number;
  remainingCapacity: number;
  additionalFormBonus?: number;
  interventionPrices?: Partial<Record<NutritionInterventionCode, number>> | null;
};

export type NutritionInterventionDraft = {
  riderId: string;
  nutritionistContractId: string | null;
  interventionCode: NutritionInterventionCode | null;
};

// The existing batch action accepts at most 35 riders. This helper only prepares
// a browser draft; the normal action remains responsible for final validation.
const MAX_NUTRITION_PLAN_RIDERS = 35;

export function buildAutomaticNutritionDrafts({
  riders,
  nutritionists,
  appliedRiderIds = [],
  balance,
}: {
  riders: readonly { riderId: string; form: number }[];
  nutritionists: readonly NutritionistInterventionOption[];
  appliedRiderIds?: readonly string[];
  balance: number;
}): NutritionInterventionDraft[] {
  if (!Number.isFinite(balance) || balance < 0) return [];
  const excludedRiders = new Set(appliedRiderIds);
  const eligibleRiders = riders.filter((rider) => {
    if (excludedRiders.has(rider.riderId) || !Number.isFinite(rider.form) || rider.form >= 100) return false;
    excludedRiders.add(rider.riderId);
    return true;
  }).sort((left, right) => left.form - right.form);
  let remainingCents = Math.round(balance * 100);
  const remainingCapacity = new Map(nutritionists.map((option) => [
    option.contractId,
    Number.isFinite(option.remainingCapacity) ? Math.max(0, Math.floor(option.remainingCapacity)) : 0,
  ]));
  const codes = Object.keys(NUTRITION_INTERVENTIONS) as NutritionInterventionCode[];
  const choices = nutritionists.flatMap((nutritionist) => codes.flatMap((code) => {
    if (nutritionist.level < NUTRITION_INTERVENTIONS[code].minimumNutritionistLevel) return [];
    const outcome = getNutritionInterventionOutcome({
      code,
      nutritionistLevel: nutritionist.level,
      additionalFormBonus: nutritionist.additionalFormBonus,
      effectivePrice: nutritionist.interventionPrices?.[code],
    });
    return [{ code, contractId: nutritionist.contractId, formGain: outcome.formGain, priceCents: Math.round(outcome.price * 100) }];
  })).sort((left, right) =>
    right.formGain - left.formGain || left.priceCents - right.priceCents || left.contractId.localeCompare(right.contractId),
  );
  const drafts: NutritionInterventionDraft[] = [];
  for (const rider of eligibleRiders) {
    if (drafts.length >= MAX_NUTRITION_PLAN_RIDERS) break;
    const choice = choices.find((option) =>
      (remainingCapacity.get(option.contractId) ?? 0) > 0 && option.priceCents <= remainingCents,
    );
    if (!choice) break;
    drafts.push({ riderId: rider.riderId, nutritionistContractId: choice.contractId, interventionCode: choice.code });
    remainingCapacity.set(choice.contractId, remainingCapacity.get(choice.contractId)! - 1);
    remainingCents -= choice.priceCents;
  }
  return drafts;
}
