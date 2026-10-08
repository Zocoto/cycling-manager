import { describe, expect, it } from "vitest";
import { parseEquipmentSales, previewEquipmentSale, type EquipmentSaleOption } from "./equipment-sale";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item: EquipmentSaleOption = {
  id: id(1), name: "Aero", quantity: 5, availableQuantity: 2, resalePrice: 500,
  pending: [{ riderId: id(4), slot: "front_wheel" }],
  equipped: [{ riderId: id(3), slot: "rear_wheel" }, { riderId: id(3), slot: "front_wheel" }],
};
const line = (quantity = 1) => ({ equipmentItemId: id(1), quantity, unequip: [], cancelPending: [] });

describe("equipment sale selection", () => {
  it("vend le stock libre sans déséquiper", () => {
    expect(previewEquipmentSale(item, 2)).toEqual(line(2));
  });
  it("annule d’abord les réservations programmées", () => {
    expect(previewEquipmentSale(item, 3)).toEqual({ ...line(3), cancelPending: item.pending });
  });
  it("distingue les deux roues d’un coureur et minimise les déséquipements", () => {
    expect(previewEquipmentSale(item, 4)).toEqual({ ...line(4), cancelPending: item.pending, unequip: [{ riderId: id(3), slot: "front_wheel" }] });
    expect(previewEquipmentSale(item, 5).unequip).toHaveLength(2);
  });
  it("accepte plusieurs références et ignore les prix fournis par le client", () => {
    expect(parseEquipmentSales([{ ...line(2), price: 999999 }, { ...line(3), equipmentItemId: id(2) }])).toEqual([line(2), { ...line(3), equipmentItemId: id(2) }]);
  });
  it.each([null, {}, [], [line(0)], [line(-1)], [line(1.5)], [line(501)], [line(300), { ...line(201), equipmentItemId: id(2) }], [line(), line()], [{ ...line(), equipmentItemId: "bad" }], [{ ...line(), unequip: null }], [{ ...line(), unequip: [{ riderId: id(3), slot: "unknown" }] }]])("refuse une sélection invalide : %j", value => {
    expect(parseEquipmentSales(value)).toBeNull();
  });
  it("refuse les doublons d’affectation mais accepte deux slots pour un coureur", () => {
    const unit = { riderId: id(3), slot: "front_wheel" };
    expect(parseEquipmentSales([{ ...line(), unequip: [unit, unit] }])).toBeNull();
    expect(parseEquipmentSales([{ ...line(2), unequip: [unit, { ...unit, slot: "rear_wheel" }] }])).not.toBeNull();
  });
  it("refuse plus de 100 références et accepte la limite de 500 unités", () => {
    expect(parseEquipmentSales(Array.from({ length: 101 }, (_, i) => ({ ...line(), equipmentItemId: id(i + 1) })))).toBeNull();
    expect(parseEquipmentSales([line(500)])).toEqual([line(500)]);
  });
});
