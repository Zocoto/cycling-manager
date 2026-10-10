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

export type PartnerBulkEquipmentSlot =
  (typeof PARTNER_BULK_EQUIPMENT_SLOTS)[number];

export function getPartnerBulkEquipmentItems(
  catalog: readonly TeamEquipmentCatalogItem[],
): Partial<Record<PartnerBulkEquipmentSlot, TeamEquipmentCatalogItem>> {
  const items: Partial<Record<PartnerBulkEquipmentSlot, TeamEquipmentCatalogItem>> = {};
  for (const slot of PARTNER_BULK_EQUIPMENT_SLOTS) {
    const item = catalog.find(
      (candidate) => candidate.slot === slot &&
        candidate.channel === "equipment_partner" && candidate.isUnlimited,
    );
    if (item) items[slot] = item;
  }
  return items;
}

export function buildPartnerBulkEquipmentAssignments({
  riders,
  itemsBySlot,
  slots,
  initialValues,
  valuesByKey,
}: {
  riders: readonly Pick<TeamEquipmentRider, "id">[];
  itemsBySlot: Partial<Record<PartnerBulkEquipmentSlot, TeamEquipmentCatalogItem>>;
  slots: readonly PartnerBulkEquipmentSlot[];
  initialValues: Readonly<Record<string, string>>;
  valuesByKey: Readonly<Record<string, string>>;
}): TeamEquipmentAssignment[] {
  const assignments: TeamEquipmentAssignment[] = [];
  const selectedSlots = new Set(slots);
  for (const riderId of new Set(riders.map((rider) => rider.id))) {
    for (const slot of PARTNER_BULK_EQUIPMENT_SLOTS) {
      if (!selectedSlots.has(slot)) continue;
      const item = itemsBySlot[slot];
      // Les montages actifs, programmés ou déjà réglés dans le brouillon
      // restent intacts, même si le DS prépare une dépose à côté.
      const key = `${riderId}:${slot}`;
      if (!item || item.slot !== slot || item.channel !== "equipment_partner" ||
        !item.isUnlimited || initialValues[key] || valuesByKey[key]) continue;
      assignments.push({ riderId, slot, equipmentItemId: item.id });
    }
  }
  return assignments;
}
