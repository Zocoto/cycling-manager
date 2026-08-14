import { EQUIPMENT_SLOTS, type EquipmentSlot } from "@/lib/game/equipment";

export const RACE_EQUIPMENT_INHERIT = "inherit";
export const RACE_EQUIPMENT_EMPTY = "empty";

export type RaceEquipmentPlanSelection =
  typeof RACE_EQUIPMENT_INHERIT | typeof RACE_EQUIPMENT_EMPTY | string;

export type RaceEquipmentPlanEntry = {
  riderId: string;
  slot: EquipmentSlot;
  selection: RaceEquipmentPlanSelection;
};

export function serializeRaceEquipmentPlanEntry(entry: RaceEquipmentPlanEntry) {
  return `${entry.riderId}|${entry.slot}|${entry.selection}`;
}

export function parseRaceEquipmentPlanEntry(
  value: FormDataEntryValue,
): RaceEquipmentPlanEntry | null {
  if (typeof value !== "string") return null;
  const [riderId, slot, selection, extra] = value.split("|");
  if (
    extra !== undefined ||
    !isUuid(riderId) ||
    !EQUIPMENT_SLOTS.includes(slot as EquipmentSlot) ||
    !isRaceEquipmentSelection(selection)
  ) {
    return null;
  }

  return {
    riderId,
    slot: slot as EquipmentSlot,
    selection,
  };
}

export function isRaceEquipmentSelection(
  value: string,
): value is RaceEquipmentPlanSelection {
  return (
    value === RACE_EQUIPMENT_INHERIT ||
    value === RACE_EQUIPMENT_EMPTY ||
    isUuid(value)
  );
}

export function resolvePlannedEquipmentItemId({
  permanentItemId,
  selection,
}: {
  permanentItemId: string | null;
  selection: RaceEquipmentPlanSelection;
}) {
  if (selection === RACE_EQUIPMENT_INHERIT) return permanentItemId;
  if (selection === RACE_EQUIPMENT_EMPTY) return null;
  return selection;
}

export function countRaceEquipmentOverrides(
  selections: Iterable<RaceEquipmentPlanSelection>,
) {
  let count = 0;
  for (const selection of selections) {
    if (selection !== RACE_EQUIPMENT_INHERIT) count += 1;
  }
  return count;
}

export function isRaceEquipmentItemSelectable({
  itemId,
  ownedQuantity,
  isUnlimited,
  riderId,
  riderIds,
  stageId,
  slot,
  selections,
  permanentByKey,
}: {
  itemId: string;
  ownedQuantity: number;
  isUnlimited: boolean;
  riderId: string;
  riderIds: readonly string[];
  stageId: string;
  slot: EquipmentSlot;
  selections: ReadonlyMap<string, RaceEquipmentPlanSelection>;
  permanentByKey: ReadonlyMap<string, string>;
}) {
  if (isUnlimited) return true;

  let usedByOtherRiders = 0;
  for (const otherRiderId of riderIds) {
    if (otherRiderId === riderId) continue;
    const selection =
      selections.get(getRaceEquipmentPlanKey(stageId, otherRiderId, slot)) ??
      RACE_EQUIPMENT_INHERIT;
    const effectiveItemId = resolvePlannedEquipmentItemId({
      permanentItemId:
        permanentByKey.get(otherRiderId + ":" + slot) ?? null,
      selection,
    });
    if (effectiveItemId === itemId) usedByOtherRiders += 1;
  }

  return usedByOtherRiders < ownedQuantity;
}

export function isRaceEquipmentStageEditable({
  departureAt,
  now = new Date(),
  freezeLeadMinutes = 5,
}: {
  departureAt: string | null;
  now?: Date;
  freezeLeadMinutes?: number;
}) {
  if (!departureAt) return false;
  const departureTime = Date.parse(departureAt);
  if (!Number.isFinite(departureTime)) return false;
  return (
    departureTime > now.getTime() + Math.max(0, freezeLeadMinutes) * 60_000
  );
}

export function getRaceEquipmentPlanKey(
  stageId: string,
  riderId: string,
  slot: EquipmentSlot,
) {
  return `${stageId}:${riderId}:${slot}`;
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}
