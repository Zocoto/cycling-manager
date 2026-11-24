import type { EquipmentSlot } from "@/lib/game/equipment";
import type {
  TeamEquipmentAssignment,
  TeamEquipmentCatalogItem,
  TeamEquipmentRider,
} from "@/services/team-equipment";

export const PARTNER_BULK_EQUIPMENT_SLOTS = [
  "front_wheel",
  "rear_wheel",
  "frame",
] as const;

export function getPartnerBulkEquipmentItems(
  catalog: readonly TeamEquipmentCatalogItem[],
): Partial<Record<EquipmentSlot, TeamEquipmentCatalogItem>> {
  const items: Partial<Record<EquipmentSlot, TeamEquipmentCatalogItem>> = {};
  for (const item of catalog) {
    if (item.channel === "equipment_partner" && item.isUnlimited && !items[item.slot]) {
      items[item.slot] = item;
    }
  }
  return items;
}

export function buildPartnerBulkEquipmentAssignments({
  riders,
  itemsBySlot,
  slots,
  initialValues,
  valuesByKey,
  blockedKeys,
}: {
  riders: readonly Pick<TeamEquipmentRider, "id">[];
  itemsBySlot: Partial<Record<EquipmentSlot, TeamEquipmentCatalogItem>>;
  slots: readonly EquipmentSlot[];
  initialValues: Readonly<Record<string, string>>;
  valuesByKey: Readonly<Record<string, string>>;
  blockedKeys?: ReadonlySet<string>;
}): TeamEquipmentAssignment[] {
  const assignments: TeamEquipmentAssignment[] = [];
  const selectedSlots = new Set(slots);
  for (const riderId of new Set(riders.map((rider) => rider.id))) {
    for (const slot of selectedSlots) {
      const item = itemsBySlot[slot];
      // Les montages actifs, programmés ou déjà réglés dans le brouillon
      // restent intacts, même si le DS prépare une dépose à côté.
      const key = `${riderId}:${slot}`;
      if (!item || item.slot !== slot || item.channel !== "equipment_partner" ||
        !item.isUnlimited || blockedKeys?.has(key) || initialValues[key] || valuesByKey[key]) continue;
      assignments.push({ riderId, slot, equipmentItemId: item.id });
    }
  }
  return assignments;
}
