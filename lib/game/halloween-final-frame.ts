import type { EquipmentEffects } from "./equipment";

/** Payload ready for the exclusive winner's inventory item when the event is activated. */
export const HALLOWEEN_FINAL_FRAME_EFFECTS = {
  ratingBonuses: { recovery: 3, resistance: 3, endurance: 3, downhill: 3 },
  specialAbilityMultipliers: { bottle_carrier: 2, locomotive: 2 },
  leaderProtectionContributionMultiplier: 1.15,
} as const satisfies Partial<EquipmentEffects>;

export const HALLOWEEN_FINAL_FRAME_IMAGE = "/images/equipment/products/headless-domestique-frame.webp";
