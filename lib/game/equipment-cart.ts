export const MAX_EQUIPMENT_CART_REFERENCES = 100;
export const MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE = 99;
export const MAX_EQUIPMENT_CART_TOTAL_QUANTITY = 500;

export type EquipmentCartLine = {
  equipmentItemId: string;
  quantity: number;
};

export type EquipmentCart = Record<string, number>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseEquipmentCartLines(
  value: unknown,
): EquipmentCartLine[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_EQUIPMENT_CART_REFERENCES
  ) {
    return null;
  }

  const lines: EquipmentCartLine[] = [];
  const seenItemIds = new Set<string>();
  let totalQuantity = 0;

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

    const candidate = entry as Record<string, unknown>;
    const equipmentItemId = candidate.equipmentItemId;
    const quantity = candidate.quantity;

    if (
      typeof equipmentItemId !== "string" ||
      !UUID_PATTERN.test(equipmentItemId) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE ||
      seenItemIds.has(equipmentItemId)
    ) {
      return null;
    }

    totalQuantity += quantity;
    if (totalQuantity > MAX_EQUIPMENT_CART_TOTAL_QUANTITY) return null;
    seenItemIds.add(equipmentItemId);
    lines.push({ equipmentItemId, quantity });
  }

  return lines;
}

export function readStoredEquipmentCart(
  serializedCart: string | null,
  availableItemIds: ReadonlySet<string>,
): EquipmentCart {
  if (!serializedCart) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedCart);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const cart: EquipmentCart = {};
  let totalQuantity = 0;

  for (const [itemId, rawQuantity] of Object.entries(parsed)) {
    if (
      Object.keys(cart).length >= MAX_EQUIPMENT_CART_REFERENCES ||
      !availableItemIds.has(itemId) ||
      typeof rawQuantity !== "number" ||
      !Number.isInteger(rawQuantity) ||
      rawQuantity < 1 ||
      rawQuantity > MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE ||
      totalQuantity + rawQuantity > MAX_EQUIPMENT_CART_TOTAL_QUANTITY
    ) {
      continue;
    }

    cart[itemId] = rawQuantity;
    totalQuantity += rawQuantity;
  }

  return cart;
}

export function serializeEquipmentCartLines(cart: EquipmentCart) {
  return Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([equipmentItemId, quantity]) => ({ equipmentItemId, quantity }));
}
