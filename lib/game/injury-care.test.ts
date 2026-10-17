import { describe, expect, it } from "vitest";
import { groupInjuryCareItems } from "./injury-care";
describe("stock des objets de soin", () => {
  const item = { inventoryId: "generic", catalogKey: "care_12", name: "Soin ciblé", recoveryHours: 12, quantity: 2 };
  it("combines both sources while retaining an actually redeemable identifier", () => {
    const items = [item, { ...item, inventoryId: "gift1", quantity: 1 }, { ...item, inventoryId: "gift2", quantity: 1 }];
    expect(groupInjuryCareItems(items)).toEqual([{ ...item, quantity: 4 }]);
    expect(item.quantity).toBe(2);
  });
  it("keeps a daily gift identifier when no generic stock remains", () => {
    expect(groupInjuryCareItems([{ ...item, inventoryId: "gift", quantity: 1 }])[0].inventoryId).toBe("gift");
  });
  it("hides empty or malformed stocks and sorts by recovery time", () => {
    expect(groupInjuryCareItems([{ ...item, recoveryHours: 0 }, { ...item, quantity: 0 },
      { ...item, recoveryHours: 49 }, { ...item, recoveryHours: 1.5 }, item,
      { ...item, catalogKey: "small", recoveryHours: 2 }, { ...item, catalogKey: "large", recoveryHours: 48 }])
      .map(i => i.recoveryHours)).toEqual([2, 12, 48]);
  });
});
