import { normalizeEquipmentMultiplier, type EquipmentEffects } from "./equipment";
import { hasSpecialAbility, type RiderSpecialAbility } from "./special-abilities";

export const BOTTLE_CARRIER_ENERGY_REDUCTION = 0.03;
export const LOCOMOTIVE_ENERGY_REDUCTION = 0.16;

type SupportRider = {
  id: string;
  teamId: string;
  specialAbility?: RiderSpecialAbility | null;
  specialAbilities?: RiderSpecialAbility[];
  equipmentEffects?: EquipmentEffects;
};

export function getSupportAbilityMultiplier(
  rider: Pick<SupportRider, "specialAbility" | "specialAbilities" | "equipmentEffects">,
  ability: "bottle_carrier" | "locomotive",
): number {
  if (!hasSpecialAbility(rider, ability)) return 0;
  const multiplier = rider.equipmentEffects?.specialAbilityMultipliers?.[ability];
  return multiplier === undefined ? 1 : normalizeEquipmentMultiplier(multiplier, 2);
}

export function getLocomotiveEnergyCostMultiplier(rider: SupportRider, isWorking: boolean): number {
  return isWorking ? 1 - LOCOMOTIVE_ENERGY_REDUCTION * getSupportAbilityMultiplier(rider, "locomotive") : 1;
}

/** The caller passes only riders in the current group, including in a team time trial. */
export function getBottleCarrierSupportEnergyCostMultiplier(rider: SupportRider, groupRiders: readonly SupportRider[]): number {
  let strongestMultiplier = 0;
  for (const teammate of groupRiders) {
    if (teammate.id === rider.id || teammate.teamId !== rider.teamId) continue;
    strongestMultiplier = Math.max(strongestMultiplier, getSupportAbilityMultiplier(teammate, "bottle_carrier"));
    if (strongestMultiplier === 2) break;
  }
  // Several carriers never stack; the strongest eligible carrier supplies the group.
  return 1 - BOTTLE_CARRIER_ENERGY_REDUCTION * strongestMultiplier;
}

export function getLeaderProtectionContributionMultiplier(effects?: EquipmentEffects): number {
  const multiplier = effects?.leaderProtectionContributionMultiplier;
  return multiplier === undefined ? 1 : normalizeEquipmentMultiplier(multiplier, 1.15);
}
