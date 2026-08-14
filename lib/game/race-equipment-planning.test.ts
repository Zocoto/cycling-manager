import { describe, expect, it } from "vitest";

import {
  RACE_EQUIPMENT_EMPTY,
  RACE_EQUIPMENT_INHERIT,
  countRaceEquipmentOverrides,
  getRaceEquipmentPlanKey,
  isRaceEquipmentItemSelectable,
  isRaceEquipmentStageEditable,
  parseRaceEquipmentPlanEntry,
  resolvePlannedEquipmentItemId,
  serializeRaceEquipmentPlanEntry,
} from "./race-equipment-planning";

const RIDER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_RIDER_ID = "33333333-3333-4333-8333-333333333333";

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

  it("conserve le matériel porté et réserve les exemplaires physiques", () => {
    const selections = new Map();
    const permanentByKey = new Map([[RIDER_ID + ":helmet", ITEM_ID]]);
    const base = {
      itemId: ITEM_ID,
      ownedQuantity: 1,
      isUnlimited: false,
      riderIds: [RIDER_ID, OTHER_RIDER_ID],
      stageId: "stage",
      slot: "helmet" as const,
      selections,
      permanentByKey,
    };

    expect(
      isRaceEquipmentItemSelectable({ ...base, riderId: RIDER_ID }),
    ).toBe(true);
    expect(
      isRaceEquipmentItemSelectable({ ...base, riderId: OTHER_RIDER_ID }),
    ).toBe(false);

    selections.set(
      getRaceEquipmentPlanKey("stage", RIDER_ID, "helmet"),
      RACE_EQUIPMENT_EMPTY,
    );
    expect(
      isRaceEquipmentItemSelectable({ ...base, riderId: OTHER_RIDER_ID }),
    ).toBe(true);
  });

  it("laisse toujours sélectionner une dotation équipementier illimitée", () => {
    expect(
      isRaceEquipmentItemSelectable({
        itemId: ITEM_ID,
        ownedQuantity: 0,
        isUnlimited: true,
        riderId: RIDER_ID,
        riderIds: [RIDER_ID],
        stageId: "stage",
        slot: "helmet",
        selections: new Map(),
        permanentByKey: new Map(),
      }),
    ).toBe(true);
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
});
