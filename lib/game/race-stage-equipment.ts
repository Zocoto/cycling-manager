import { EQUIPMENT_SLOTS, type EquipmentEffects, type EquipmentSlot } from "./equipment";
import type { RaceStageType } from "./race-calendar";
import { RIDER_RATING_AXES, type RiderRatingKey } from "./rider-profile";

export type StageEquipmentItem = {
  slot: EquipmentSlot;
  equipmentItemId: string | null;
  name: string | null;
};

/** Saved with the official input, never reconstructed from today's equipment. */
export type StageEquipmentSnapshot = {
  items: StageEquipmentItem[];
  ratingBonuses: Partial<Record<RiderRatingKey, number>>;
  ratingChanges: Partial<Record<RiderRatingKey, number>>;
};

export type StageEquipmentChange = {
  items: StageEquipmentItem[];
  permanentEffects: EquipmentEffects;
};

/** Same slot resolution as the official stage, including prizes and R&D. */
export function readPermanentStageEquipmentPayloads(values: readonly unknown[]): unknown[] {
  return values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const payload = value as Record<string, unknown>;
    if (payload._stageSpecific !== true) return value;
    const permanent = payload._permanentEffect;
    return {
      ...(permanent && typeof permanent === "object" && !Array.isArray(permanent) ? permanent : {}),
      _slotType: payload._slotType,
    };
  });
}

export function readStageEquipmentItems(values: readonly unknown[]): StageEquipmentItem[] {
  return values.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const payload = value as Record<string, unknown>;
    const slot = payload._slotType as EquipmentSlot;
    if (payload._stageSpecific !== true || !EQUIPMENT_SLOTS.includes(slot)) return [];
    const equipmentItemId = typeof payload._equipmentItemId === "string"
      ? payload._equipmentItemId : null;
    if (equipmentItemId && typeof payload._equipmentName !== "string") return [];
    return [{ slot, equipmentItemId, name: equipmentItemId ? String(payload._equipmentName) : null }];
  });
}

export function buildStageEquipmentSnapshot({ items, effects, permanentEffects, stageType }: {
  items: readonly StageEquipmentItem[];
  effects: EquipmentEffects;
  permanentEffects: EquipmentEffects | undefined;
  stageType: RaceStageType;
}): StageEquipmentSnapshot | undefined {
  if (items.length === 0) return undefined;
  const isTimeTrial = stageType !== "road";
  const ratingBonuses: StageEquipmentSnapshot["ratingBonuses"] = {};
  const ratingChanges: StageEquipmentSnapshot["ratingChanges"] = {};
  for (const { key } of RIDER_RATING_AXES) {
    const bonus = (effects.ratingBonuses[key] ?? 0)
      + (isTimeTrial ? effects.timeTrialRatingBonuses[key] ?? 0 : 0);
    const permanentBonus = (permanentEffects?.ratingBonuses[key] ?? 0)
      + (isTimeTrial ? permanentEffects?.timeTrialRatingBonuses[key] ?? 0 : 0);
    // Keep staff-enhanced decimals, removing only floating-point noise.
    const roundedBonus = Math.round(bonus * 1_000_000) / 1_000_000;
    const change = Math.round((bonus - permanentBonus) * 1_000_000) / 1_000_000;
    if (roundedBonus !== 0) ratingBonuses[key] = roundedBonus;
    if (change !== 0) ratingChanges[key] = change;
  }
  return { items: items.map((item) => ({ ...item })), ratingBonuses, ratingChanges };
}
