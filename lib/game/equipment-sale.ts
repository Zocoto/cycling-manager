import { EQUIPMENT_SLOTS, type EquipmentSlot } from "@/lib/game/equipment";

export const MAX_EQUIPMENT_SALE_REFERENCES = 100;
export const MAX_EQUIPMENT_SALE_UNITS = 500;
export type EquipmentSaleAssignment = { riderId: string; slot: EquipmentSlot };
export type EquipmentSaleLine = {
  equipmentItemId: string;
  quantity: number;
  unequip: EquipmentSaleAssignment[];
  cancelPending: EquipmentSaleAssignment[];
};
export type EquipmentSaleOption = {
  id: string;
  name: string;
  quantity: number;
  availableQuantity: number;
  resalePrice: number;
  equipped: EquipmentSaleAssignment[];
  pending: EquipmentSaleAssignment[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseEquipmentSales(value: unknown): EquipmentSaleLine[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EQUIPMENT_SALE_REFERENCES) return null;
  const seen = new Set<string>();
  const lines: EquipmentSaleLine[] = [];
  let total = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { equipmentItemId, quantity, unequip, cancelPending } = entry;
    if (typeof equipmentItemId !== "string" || !UUID.test(equipmentItemId) ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_EQUIPMENT_SALE_UNITS) return null;
    const id = equipmentItemId.toLowerCase();
    if (seen.has(id)) return null;
    seen.add(id);
    total += quantity;
    if (total > MAX_EQUIPMENT_SALE_UNITS) return null;
    const current = parseAssignments(unequip), pending = parseAssignments(cancelPending);
    if (!current || !pending) return null;
    lines.push({ equipmentItemId: id, quantity, unequip: current, cancelPending: pending });
  }
  return lines;
}

export function previewEquipmentSale(item: EquipmentSaleOption, quantity: number): EquipmentSaleLine {
  let remaining = Math.max(0, quantity - item.availableQuantity);
  const cancelPending = sortAssignments(item.pending).slice(0, remaining);
  remaining -= cancelPending.length;
  const unequip = sortAssignments(item.equipped).slice(0, remaining);
  return { equipmentItemId: item.id, quantity, unequip, cancelPending };
}

function sortAssignments(assignments: EquipmentSaleAssignment[]) {
  return [...assignments].sort((a, b) => {
    const left = `${a.riderId.toLowerCase()}:${a.slot}`, right = `${b.riderId.toLowerCase()}:${b.slot}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
function parseAssignments(value: unknown): EquipmentSaleAssignment[] | null {
  if (!Array.isArray(value) || value.length > MAX_EQUIPMENT_SALE_UNITS) return null;
  const seen = new Set<string>();
  const assignments: EquipmentSaleAssignment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.riderId !== "string" ||
      !UUID.test(entry.riderId) || !EQUIPMENT_SLOTS.includes(entry.slot)) return null;
    const key = `${entry.riderId.toLowerCase()}:${entry.slot}`;
    if (seen.has(key)) return null;
    seen.add(key);
    assignments.push({ riderId: entry.riderId.toLowerCase(), slot: entry.slot });
  }
  return sortAssignments(assignments);
}
