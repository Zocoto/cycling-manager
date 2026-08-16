import { describe, expect, it } from "vitest";

import {
  RACE_EQUIPMENT_EMPTY,
  RACE_EQUIPMENT_INHERIT,
  countRaceEquipmentOverrides,
  formatRaceEquipmentOptionLabel,
  getRaceEquipmentAvailableQuantity,
  getRaceEquipmentStockConflicts,
  isRaceEquipmentItemSelectable,
  getRaceEquipmentPlanKey,
  isRaceEquipmentStageEditable,
  parseRaceEquipmentPlanEntry,
  resolvePlannedEquipmentItemId,
  serializeRaceEquipmentPlanEntry,
} from "./race-equipment-planning";

const RIDER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

describe("planification du matériel de course", () => {
  it("sérialise et relit un choix de matériel", () => {
    const serialized = serializeRaceEquipmentPlanEntry({
      riderId: RIDER_ID,
      slot: "helmet",
      selection: ITEM_ID,
    });

    expect(serialized).toBe(`${RIDER_ID}|helmet|${ITEM_ID}`);
    expect(parseRaceEquipmentPlanEntry(serialized)).toEqual({
      riderId: RIDER_ID,
      slot: "helmet",
      selection: ITEM_ID,
    });
  });

  it("accepte l’héritage et l’emplacement vide", () => {
    expect(
      parseRaceEquipmentPlanEntry(
        `${RIDER_ID}|frame|${RACE_EQUIPMENT_INHERIT}`,
      ),
    ).toMatchObject({ selection: RACE_EQUIPMENT_INHERIT });
    expect(
      parseRaceEquipmentPlanEntry(`${RIDER_ID}|frame|${RACE_EQUIPMENT_EMPTY}`),
    ).toMatchObject({ selection: RACE_EQUIPMENT_EMPTY });
  });

  it("rejette les identifiants, emplacements et valeurs forgés", () => {
    expect(parseRaceEquipmentPlanEntry(`rider|helmet|${ITEM_ID}`)).toBeNull();
    expect(
      parseRaceEquipmentPlanEntry(`${RIDER_ID}|moteur|${ITEM_ID}`),
    ).toBeNull();
    expect(
      parseRaceEquipmentPlanEntry(`${RIDER_ID}|helmet|inconnu`),
    ).toBeNull();
    expect(
      parseRaceEquipmentPlanEntry(`${RIDER_ID}|helmet|${ITEM_ID}|surplus`),
    ).toBeNull();
  });

  it("distingue clairement héritage, vide et surcharge", () => {
    expect(
      resolvePlannedEquipmentItemId({
        permanentItemId: ITEM_ID,
        selection: RACE_EQUIPMENT_INHERIT,
      }),
    ).toBe(ITEM_ID);
    expect(
      resolvePlannedEquipmentItemId({
        permanentItemId: ITEM_ID,
        selection: RACE_EQUIPMENT_EMPTY,
      }),
    ).toBeNull();
    expect(
      resolvePlannedEquipmentItemId({
        permanentItemId: null,
        selection: ITEM_ID,
      }),
    ).toBe(ITEM_ID);
  });

  it("compte uniquement les choix propres à la course", () => {
    expect(
      countRaceEquipmentOverrides([
        RACE_EQUIPMENT_INHERIT,
        ITEM_ID,
        RACE_EQUIPMENT_EMPTY,
      ]),
    ).toBe(2);
  });

  it("ferme les changements cinq minutes avant le départ", () => {
    const now = new Date("2026-08-09T10:00:00.000Z");
    expect(
      isRaceEquipmentStageEditable({
        departureAt: "2026-08-09T10:06:00.000Z",
        now,
      }),
    ).toBe(true);
    expect(
      isRaceEquipmentStageEditable({
        departureAt: "2026-08-09T10:05:00.000Z",
        now,
      }),
    ).toBe(false);
  });

  it("construit une clé stable par étape, coureur et emplacement", () => {
    expect(getRaceEquipmentPlanKey("stage", RIDER_ID, "rear_wheel")).toBe(
      `stage:${RIDER_ID}:rear_wheel`,
    );
  });

  it("rend au groupe engagé les exemplaires portés par ses coureurs", () => {
    expect(
      getRaceEquipmentAvailableQuantity({
        availableQuantity: 0,
        permanentRosterQuantity: 1,
        isUnlimited: false,
      }),
    ).toBe(1);
    expect(
      getRaceEquipmentAvailableQuantity({
        availableQuantity: 0,
        permanentRosterQuantity: 0,
        isUnlimited: false,
      }),
    ).toBe(0);
    expect(
      getRaceEquipmentAvailableQuantity({
        availableQuantity: 0,
        permanentRosterQuantity: 0,
        isUnlimited: true,
      }),
    ).toBe(1);
  });

  it("grise un objet consommé ailleurs mais conserve le choix courant", () => {
    const item = { availableQuantity: 1, isUnlimited: false };
    expect(
      isRaceEquipmentItemSelectable({
        item,
        usedQuantity: 1,
        isCurrentSelection: false,
      }),
    ).toBe(false);
    expect(
      isRaceEquipmentItemSelectable({
        item,
        usedQuantity: 1,
        isCurrentSelection: true,
      }),
    ).toBe(true);
  });

  it("signale les dépassements du contingent disponible", () => {
    expect(
      getRaceEquipmentStockConflicts({
        catalog: [
          {
            id: ITEM_ID,
            name: "Cadre test",
            availableQuantity: 1,
            isUnlimited: false,
          },
        ],
        usageByItemId: new Map([[ITEM_ID, 2]]),
      }),
    ).toEqual([
      {
        itemId: ITEM_ID,
        label: "Cadre test (2/1)",
      },
    ]);
  });

  it("place les bonus et l’indisponibilité dans le libellé de l’option", () => {
    expect(
      formatRaceEquipmentOptionLabel({
        name: "Cadre test",
        supplierName: "Atelier",
        effectSummary: "+2 MON · +1 END",
        isAvailable: false,
      }),
    ).toBe("Cadre test · Atelier · +2 MON · +1 END · indisponible");
  });
});
