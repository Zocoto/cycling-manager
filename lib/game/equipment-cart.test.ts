import { describe, expect, it } from "vitest";

import {
  parseEquipmentCartLines,
  readStoredEquipmentCart,
  serializeEquipmentCartLines,
} from "./equipment-cart";

const HELMET_ID = "11111111-1111-4111-8111-111111111111";
const WHEEL_ID = "22222222-2222-4222-8222-222222222222";

describe("equipment cart", () => {
  it("validates a grouped purchase and rejects duplicate references", () => {
    expect(
      parseEquipmentCartLines([
        { equipmentItemId: HELMET_ID, quantity: 2 },
        { equipmentItemId: WHEEL_ID, quantity: 3 },
      ]),
    ).toEqual([
      { equipmentItemId: HELMET_ID, quantity: 2 },
      { equipmentItemId: WHEEL_ID, quantity: 3 },
    ]);
    expect(
      parseEquipmentCartLines([
        { equipmentItemId: HELMET_ID, quantity: 1 },
        { equipmentItemId: HELMET_ID, quantity: 1 },
      ]),
    ).toBeNull();
  });

  it("keeps only purchasable catalog entries from local storage", () => {
    expect(
      readStoredEquipmentCart(
        JSON.stringify({
          [HELMET_ID]: 2,
          [WHEEL_ID]: 3,
          "33333333-3333-4333-8333-333333333333": 4,
          invalid: -1,
        }),
        new Set([HELMET_ID, WHEEL_ID]),
      ),
    ).toEqual({ [HELMET_ID]: 2, [WHEEL_ID]: 3 });
  });

  it("serializes the quantities sent to the atomic checkout action", () => {
    expect(
      serializeEquipmentCartLines({
        [HELMET_ID]: 2,
        [WHEEL_ID]: 0,
      }),
    ).toEqual([{ equipmentItemId: HELMET_ID, quantity: 2 }]);
  });
});
