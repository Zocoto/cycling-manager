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

export type RaceEquipmentStockItem = {
  id: string;
  name: string;
  availableQuantity: number;
  isUnlimited: boolean;
};

export function getRaceEquipmentAvailableQuantity({
  availableQuantity,
  permanentRosterQuantity,
  isUnlimited,
}: {
  availableQuantity: number;
  permanentRosterQuantity: number;
  isUnlimited: boolean;
}) {
  if (isUnlimited) return Math.max(1, availableQuantity);
  return (
    Math.max(0, availableQuantity) + Math.max(0, permanentRosterQuantity)
  );
}

export function isRaceEquipmentItemSelectable({
  item,
  usedQuantity,
  isCurrentSelection,
}: {
  item: Pick<RaceEquipmentStockItem, "availableQuantity" | "isUnlimited">;
  usedQuantity: number;
  isCurrentSelection: boolean;
}) {
  if (item.isUnlimited) return true;
  const usedOutsideCurrentSlot = Math.max(
    0,
    usedQuantity - (isCurrentSelection ? 1 : 0),
  );
  return usedOutsideCurrentSlot < Math.max(0, item.availableQuantity);
}

export function getRaceEquipmentStockConflicts({
  catalog,
  usageByItemId,
}: {
  catalog: readonly RaceEquipmentStockItem[];
  usageByItemId: ReadonlyMap<string, number>;
}) {
  return catalog.flatMap((item) => {
    const usedQuantity = usageByItemId.get(item.id) ?? 0;
    return !item.isUnlimited && usedQuantity > item.availableQuantity
      ? [
          {
            itemId: item.id,
            label:
              item.name +
              " (" +
              usedQuantity +
              "/" +
              item.availableQuantity +
              ")",
          },
        ]
      : [];
  });
}

export function formatRaceEquipmentOptionLabel({
  name,
  supplierName,
  effectSummary,
  isAvailable,
}: {
  name: string;
  supplierName: string;
  effectSummary: string;
  isAvailable: boolean;
}) {
  return [
    name,
    supplierName,
    effectSummary,
    ...(isAvailable ? [] : ["indisponible"]),
  ]
    .filter(Boolean)
    .join(" · ");
}

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
