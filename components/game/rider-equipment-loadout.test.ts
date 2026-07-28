import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS, type EquipmentSlot } from "@/lib/game/equipment";
import type {
  RiderEquipmentManagement,
  TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

import {
  collectAvailableEquipment,
  EquipmentBonusSummary,
} from "./rider-equipment-loadout";

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
    channel: "commercial",
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
  it("regroupe chaque statistique dans une seule pastille cumulée", () => {
    const markup = renderToStaticMarkup(
      createElement(EquipmentBonusSummary, {
        effects: {
          ratingBonuses: { timeTrial: 2, acceleration: 2 },
          timeTrialRatingBonuses: {
            timeTrial: 2,
            acceleration: 1,
            endurance: 1,
          },
          injuryRiskReductionPct: 0,
          breakawayReputationBonus: 0,
          victoryReputationBonus: 0,
        },
      }),
    );

    expect(markup.match(/CLM \+4/g)).toHaveLength(1);
    expect(markup.match(/ACC \+3/g)).toHaveLength(1);
    expect(markup.match(/END \+1/g)).toHaveLength(1);
    expect(markup).not.toContain("· CLM");
  });
});
