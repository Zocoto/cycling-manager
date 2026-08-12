import type { EquipmentSlot } from "@/lib/game/equipment";

export const EQUIPMENT_PARTNER_REPUTATION_THRESHOLD = 200;
export const EQUIPMENT_PARTNER_CONTRACT_SEASONS = 2;

export const EQUIPMENT_PARTNER_CORE_SLOTS = [
  "frame",
  "front_wheel",
  "rear_wheel",
] as const satisfies ReadonlyArray<EquipmentSlot>;

export function canSignEquipmentPartnerContract(reputationPoints: number) {
  return reputationPoints >= EQUIPMENT_PARTNER_REPUTATION_THRESHOLD;
}

export function getEquipmentPartnerContractEndYear(startGameYear: number) {
  return startGameYear + EQUIPMENT_PARTNER_CONTRACT_SEASONS - 1;
}