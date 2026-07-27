import type { EquipmentSlot } from "@/lib/game/equipment";

export const EQUIPMENT_PARTNER_REPUTATION_THRESHOLD = 50;
export const EQUIPMENT_PARTNER_CONTRACT_SEASONS = 2;
export const EQUIPMENT_PARTNER_RND_DURATION_DAYS = 3;
export const EQUIPMENT_PARTNER_RND_SUCCESS_RATE = 0.5;
export const EQUIPMENT_PARTNER_RARE_OFFER_RATE = 0.1;
export const EQUIPMENT_PARTNER_RARE_OFFER_DURATION_DAYS = 3;
export const EQUIPMENT_PARTNER_TEAM_STOCK = 35;

export const EQUIPMENT_PARTNER_CORE_SLOTS = [
  "frame",
  "front_wheel",
  "rear_wheel",
] as const satisfies ReadonlyArray<EquipmentSlot>;

export type EquipmentPartnerRndOutcome = "improvement" | "setback";

export function canSignEquipmentPartnerContract(reputationPoints: number) {
  return reputationPoints >= EQUIPMENT_PARTNER_REPUTATION_THRESHOLD;
}

export function resolveEquipmentPartnerRndOutcome(
  randomValue: number,
): EquipmentPartnerRndOutcome {
  return randomValue < EQUIPMENT_PARTNER_RND_SUCCESS_RATE
    ? "improvement"
    : "setback";
}

export function getEquipmentPartnerRndDelta(
  outcome: EquipmentPartnerRndOutcome,
) {
  return outcome === "improvement" ? 1 : -1;
}

export function getEquipmentPartnerContractEndYear(startGameYear: number) {
  return startGameYear + EQUIPMENT_PARTNER_CONTRACT_SEASONS - 1;
}

export function shouldGenerateRareEquipmentOffer(randomValue: number) {
  return randomValue < EQUIPMENT_PARTNER_RARE_OFFER_RATE;
}
