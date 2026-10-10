import { describe, expect, it } from "vitest";

import type { TeamEquipmentCatalogItem } from "@/services/team-equipment";
import {
  buildPartnerBulkEquipmentAssignments,
  getPartnerBulkEquipmentItems,
  PARTNER_BULK_EQUIPMENT_SLOTS,
  type PartnerBulkEquipmentSlot,
} from "./partner-equipment-bulk";

const catalog = PARTNER_BULK_EQUIPMENT_SLOTS.map((slot) => ({
  id: `partner-${slot}`, slot, channel: "equipment_partner", isUnlimited: true,
} as TeamEquipmentCatalogItem));
const itemsBySlot = getPartnerBulkEquipmentItems(catalog);
const riders = [{ id: "a" }, { id: "b" }];

function build(overrides: Partial<Parameters<typeof buildPartnerBulkEquipmentAssignments>[0]> = {}) {
  return buildPartnerBulkEquipmentAssignments({
    riders, itemsBySlot, slots: PARTNER_BULK_EQUIPMENT_SLOTS,
    initialValues: {}, valuesByKey: {}, ...overrides,
  });
}

describe("équipementier : affectation groupée aux emplacements vides", () => {
  it("ne propose que les cadres et roues disponibles du contrat actif", () => {
    const unavailable = { ...catalog[0], id: "unavailable", isUnlimited: false };
    const commercial = { ...catalog[0], id: "commercial", channel: "commercial", ownedQuantity: 100 };
    const prototype = { ...catalog[0], id: "prototype", channel: "research_prototype" };
    const otherSlot = { ...catalog[0], id: "shoes", slot: "shoes" };
    const result = getPartnerBulkEquipmentItems([
      unavailable, commercial, prototype, otherSlot, ...catalog,
    ] as TeamEquipmentCatalogItem[]);
    expect(result).toEqual(itemsBySlot);
    expect(getPartnerBulkEquipmentItems([unavailable, commercial] as TeamEquipmentCatalogItem[])).toEqual({});
  });

  it("complète les trois emplacements de tous les coureurs ciblés", () => {
    expect(build()).toEqual(riders.flatMap(({ id }) => PARTNER_BULK_EQUIPMENT_SLOTS.map((slot) => ({
      riderId: id, slot, equipmentItemId: `partner-${slot}`,
    }))));
  });

  it.each([
    [], ["frame"], ["front_wheel"], ["rear_wheel"],
    ["frame", "front_wheel"], ["frame", "rear_wheel"],
    ["front_wheel", "rear_wheel"], [...PARTNER_BULK_EQUIPMENT_SLOTS],
  ] as PartnerBulkEquipmentSlot[][])("respecte chaque combinaison de cases cochées : %j", (...slots) => {
    const result = build({ slots });
    expect(result).toHaveLength(riders.length * slots.length);
    expect(result.every((assignment) => slots.includes(assignment.slot as PartnerBulkEquipmentSlot))).toBe(true);
  });

  it("préserve les pièces actives ou programmées et les réglages manuels", () => {
    const initialValues = { "a:frame": "commercial-frame", "a:front_wheel": "pending-wheel" };
    const valuesByKey = { ...initialValues, "b:rear_wheel": "manual-prototype" };
    expect(build({ initialValues, valuesByKey })).toEqual([
      { riderId: "a", slot: "rear_wheel", equipmentItemId: "partner-rear_wheel" },
      { riderId: "b", slot: "front_wheel", equipmentItemId: "partner-front_wheel" },
      { riderId: "b", slot: "frame", equipmentItemId: "partner-frame" },
    ]);
  });

  it("ne remplace pas une dépose déjà préparée par le DS", () => {
    expect(build({
      slots: ["frame"], initialValues: { "a:frame": "existing" },
      valuesByKey: { "a:frame": "" },
    })).toEqual([{ riderId: "b", slot: "frame", equipmentItemId: "partner-frame" }]);
  });

  it("respecte le filtre de coureurs et ne modifie pas les autres", () => {
    expect(build({ riders: [riders[1]], slots: ["frame"] })).toEqual([
      { riderId: "b", slot: "frame", equipmentItemId: "partner-frame" },
    ]);
    expect(build({ riders: [] })).toEqual([]);
  });

  it("reste idempotent quand on réapplique le raccourci", () => {
    const valuesByKey = Object.fromEntries(build().map((assignment) => [
      `${assignment.riderId}:${assignment.slot}`, assignment.equipmentItemId,
    ]));
    expect(build({ valuesByKey })).toEqual([]);
  });

  it("ignore les emplacements sans dotation et n’inverse pas les roues", () => {
    expect(build({ itemsBySlot: { frame: itemsBySlot.frame } })).toHaveLength(2);
    expect(build({ itemsBySlot: { rear_wheel: itemsBySlot.front_wheel } })).toEqual([]);
  });

  it("refuse une pièce étrangère à la dotation même dans la sélection transmise", () => {
    for (const item of [
      { ...catalog[2], isUnlimited: false },
      { ...catalog[2], channel: "commercial" },
    ] as TeamEquipmentCatalogItem[]) {
      expect(build({ itemsBySlot: { frame: item } })).toEqual([]);
    }
  });

  it("ne produit pas de doublons et laisse les données d’entrée intactes", () => {
    const initialValues = Object.freeze({ "a:frame": "existing" });
    const valuesByKey = Object.freeze({ "a:frame": "existing", "a:helmet": "helmet" });
    const result = build({ riders: [riders[0], riders[0]], slots: ["frame", "front_wheel", "front_wheel"], initialValues, valuesByKey });
    expect(result).toEqual([{ riderId: "a", slot: "front_wheel", equipmentItemId: "partner-front_wheel" }]);
    expect(valuesByKey).toEqual({ "a:frame": "existing", "a:helmet": "helmet" });
  });

  it("prépare une grande équipe sans consommer de stock physique", () => {
    expect(build({ riders: Array.from({ length: 35 }, (_, index) => ({ id: `rider-${index}` })) })).toHaveLength(105);
  });
});
