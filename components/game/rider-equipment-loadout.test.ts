import { describe, expect, it } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS, type EquipmentSlot } from "@/lib/game/equipment";
import type {
  RiderEquipmentManagement,
  TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

import { collectAvailableEquipment } from "./rider-equipment-loadout";

const EMPTY_BY_SLOT = {
  helmet: [],
  gloves: [],
  bib_shorts: [],
  glasses: [],
  shoes: [],
  front_wheel: [],
  rear_wheel: [],
  frame: [],
} satisfies Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;

function equipment(
  id: string,
  name: string,
  slot: EquipmentSlot,
): TeamEquipmentCatalogItem {
  return {
    id,
    catalogKey: id,
    name,
    slot,
    supplierKey: "test",
    supplierName: "Test",
    supplierLogoPath: "/test.svg",
    supplierPrimaryColor: "#000000",
    supplierSecondaryColor: "#ffffff",
    supplierPositioning: "Test",
    description: name,
    price: 100,
    rarity: "common",
    imagePath: "/images/equipment/products/test.webp",
    effectSummary: "Test",
    effects: EMPTY_EQUIPMENT_EFFECTS,
    ownedQuantity: 1,
    equippedQuantity: 0,
    pendingQuantity: 0,
    availableQuantity: 1,
  };
}

describe("collectAvailableEquipment", () => {
  it("retire de la réserve les pièces déjà équipées ou programmées", () => {
    const wornHelmet = equipment("helmet-worn", "Casque porté", "helmet");
    const freeHelmet = equipment("helmet-free", "Casque libre", "helmet");
    const pendingGloves = equipment("gloves-pending", "Gants programmés", "gloves");
    const freeGloves = equipment("gloves-free", "Gants libres", "gloves");
    const management: RiderEquipmentManagement = {
      current: { helmet: wornHelmet },
      pending: {
        gloves: {
          item: pendingGloves,
          effectiveAt: "2026-07-26T12:00:00.000Z",
        },
      },
      availableBySlot: {
        ...EMPTY_BY_SLOT,
        helmet: [wornHelmet, freeHelmet],
        gloves: [pendingGloves, freeGloves],
      },
    };

    expect(
      collectAvailableEquipment(management, { helmet: wornHelmet }).map(
        (item) => item.id,
      ),
    ).toEqual(["helmet-free", "gloves-free"]);
  });
});
