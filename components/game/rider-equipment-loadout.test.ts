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
  CyclistEquipmentVisual,
  EquipmentBonusSummary,
  RiderEquipmentLoadout,
  resolveEquipmentDropAction,
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
    resalePrice: 100,
    rarity: "common",
    imagePath: "/images/equipment/products/test.webp",
    effectSummary: "Test",
    effects: EMPTY_EQUIPMENT_EFFECTS,
    channel: "commercial",
    ownedQuantity: 1,
    equippedQuantity: 0,
    pendingQuantity: 0,
    availableQuantity: 1,
    isUnlimited: false,
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

describe("CyclistEquipmentVisual side slots", () => {
  it("conserve le cycliste normal tant qu’aucun matériel n’est équipé", () => {
    const markup = renderToStaticMarkup(
      createElement(CyclistEquipmentVisual, {
        equipment: {},
        pending: {},
        compatibleDragSlot: null,
        activeDropSlot: null,
        selectedSlot: "helmet",
        onSelectSlot: () => undefined,
        onDragOverSlot: () => undefined,
        onDropSlot: () => undefined,
      }),
    );

    expect(markup).toContain(
      'alt="Cycliste de route au centre de ses emplacements d’équipement"',
    );
    expect(markup).toContain('data-equipment-layout="side-slots"');
    expect(markup).toContain('data-equipment-slot-column="left"');
    expect(markup).toContain('data-equipment-slot-column="right"');
    expect(markup.match(/data-equipment-zone=/g)).toHaveLength(8);
    expect(markup).not.toContain("data-equipment-color-layer");
    expect(markup).not.toContain("data-equipment-visual-source");
  });
  it("affiche les pièces équipées dans les emplacements latéraux", () => {
    const wornHelmet = equipment("helmet-worn", "Casque porté", "helmet");
    const markup = renderToStaticMarkup(
      createElement(CyclistEquipmentVisual, {
        equipment: { helmet: wornHelmet },
        pending: {},
        compatibleDragSlot: null,
        activeDropSlot: null,
        selectedSlot: "helmet",
        onSelectSlot: () => undefined,
        onDragOverSlot: () => undefined,
        onDropSlot: () => undefined,
      }),
    );

    expect(markup.match(/data-equipment-zone=/g)).toHaveLength(8);
    expect(markup).toContain('data-equipment-zone="helmet"');
    expect(markup).toContain('data-equipped="true"');
    expect(markup).toContain("touch-manipulation");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-equipment-item-name="Casque porté"');
    expect(markup).toContain(
      'aria-label="Casque équipé : Casque porté. Glissez vers la réserve pour le retirer."',
    );
    expect(markup).toContain('alt="Visuel de Casque porté"');
    expect(markup).toContain('data-equipment-zone="gloves"');
    expect(markup).toContain('data-equipped="false"');
    expect(markup).toContain('data-zone-state="empty"');
    expect(markup).toContain("Casque porté");
    expect(markup).toContain(encodeURIComponent(wornHelmet.imagePath));
    expect(markup).toContain("1/8 équipé");
  });

  it("annonce clairement le remplacement sur la carte compatible", () => {
    const wornHelmet = equipment("helmet-worn", "Casque porté", "helmet");
    const markup = renderToStaticMarkup(
      createElement(CyclistEquipmentVisual, {
        equipment: { helmet: wornHelmet },
        pending: {},
        compatibleDragSlot: "helmet",
        draggedItemName: "Casque neuf",
        activeDropSlot: "helmet",
        selectedSlot: "helmet",
        canDragEquipment: true,
        onSelectSlot: () => undefined,
        onDragStartEquipped: () => undefined,
        onDragEndEquipped: () => undefined,
        onDragOverSlot: () => undefined,
        onDropSlot: () => undefined,
      }),
    );

    expect(markup).toContain("Remplacer Casque porté par Casque neuf");
    expect(markup).toContain('draggable="true"');
    expect(markup).toContain(encodeURIComponent(wornHelmet.imagePath));
  });

  it("préserve une lecture claire sur ordinateur et téléphone", () => {
    const markup = renderToStaticMarkup(
      createElement(CyclistEquipmentVisual, {
        equipment: {},
        pending: {},
        compatibleDragSlot: null,
        activeDropSlot: null,
        selectedSlot: "helmet",
        onSelectSlot: () => undefined,
        onDragOverSlot: () => undefined,
        onDropSlot: () => undefined,
      }),
    );
    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain(
      "lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1.15fr)_minmax(0,1fr)]",
    );
    expect(markup).toContain("order-first");
    expect(markup.match(/>Vide<\/strong>/g)).toHaveLength(8);
    expect(markup).not.toContain("Emplacement vide");
    expect(markup).toContain("[overflow-wrap:anywhere]");
    expect(markup).toContain("min-w-0 touch-manipulation overflow-hidden");
  });
});

describe("resolveEquipmentDropAction", () => {
  it("équipe ou remplace une pièce libre déposée sur le slot compatible", () => {
    expect(
      resolveEquipmentDropAction({
        source: "reserve",
        draggedSlot: "helmet",
        target: "helmet",
        targetOccupied: false,
      }),
    ).toBe("equip");
    expect(
      resolveEquipmentDropAction({
        source: "reserve",
        draggedSlot: "helmet",
        target: "helmet",
        targetOccupied: true,
      }),
    ).toBe("replace");
  });

  it("déséquipe une pièce portée déposée dans la réserve", () => {
    expect(
      resolveEquipmentDropAction({
        source: "rider",
        draggedSlot: "gloves",
        target: "reserve",
        targetOccupied: false,
      }),
    ).toBe("unequip");
  });

  it("refuse les slots incompatibles et le déplacement d’une pièce portée entre slots", () => {
    expect(
      resolveEquipmentDropAction({
        source: "reserve",
        draggedSlot: "helmet",
        target: "gloves",
        targetOccupied: false,
      }),
    ).toBeNull();
    expect(
      resolveEquipmentDropAction({
        source: "rider",
        draggedSlot: "helmet",
        target: "helmet",
        targetOccupied: true,
      }),
    ).toBeNull();
  });
});
describe("RiderEquipmentLoadout", () => {
  it("conserve un en-tête sobre sans les textes redondants", () => {
    const markup = renderToStaticMarkup(
      createElement(RiderEquipmentLoadout, {
        riderId: "rider-test",
        equipment: {},
        canManage: false,
        management: null,
      }),
    );

    expect(markup).toContain("Équipement");
    expect(markup).not.toContain("Configuration du coureur");
    expect(markup).not.toContain(
      "Les pièces portées apparaissent et s’illuminent",
    );
    expect(markup).not.toContain("Modifiable par votre équipe");
    expect(markup).not.toContain("Consultation publique");
  });
});
