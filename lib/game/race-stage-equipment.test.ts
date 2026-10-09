import { describe, expect, it } from "vitest";
import { combineEquipmentEffects, normalizeEquipmentEffects } from "./equipment";
import { buildStageEquipmentSnapshot, readStageEquipmentItems, readPermanentStageEquipmentPayloads } from "./race-stage-equipment";

const items = [{ slot: "frame" as const, equipmentItemId: "frame-2", name: "Cadre des cols" }];

describe("stage equipment snapshots", () => {
  it("compares against the same official slot resolver, including unchanged gala prizes", () => {
    const values = [
      { _slotType: "gloves", ratingBonuses: { hills: 2 } },
      { _stageSpecific: true, _slotType: "frame", ratingBonuses: { mountain: 4 }, _permanentEffect: { ratingBonuses: { mountain: 1 } } },
    ];
    expect(readPermanentStageEquipmentPayloads(values)).toEqual([values[0], { _slotType: "frame", ratingBonuses: { mountain: 1 } }]);
    const snapshot = buildStageEquipmentSnapshot({ items, stageType: "road", effects: combineEquipmentEffects(values.map(normalizeEquipmentEffects)), permanentEffects: combineEquipmentEffects(readPermanentStageEquipmentPayloads(values).map(normalizeEquipmentEffects)) });
    expect(snapshot?.ratingBonuses).toEqual({ mountain: 4, hills: 2 });
    expect(snapshot?.ratingChanges).toEqual({ mountain: 3 });
  });
  it("ignores permanent gear, old payloads and malformed provenance", () => {
    expect(readStageEquipmentItems([null, [], { _slotType: "frame" }, { _stageSpecific: true, _slotType: "unknown" }, { _stageSpecific: true, _slotType: "frame", _equipmentItemId: "id" }])).toEqual([]);
  });
  it("reads selected equipment and explicit removals without adding effects", () => {
    const values = [
      { _stageSpecific: true, _slotType: "frame", _equipmentItemId: "frame-2", _equipmentName: "Cadre des cols", ratingBonuses: { mountain: 3 } },
      { _stageSpecific: true, _slotType: "front_wheel", _equipmentItemId: null, _equipmentName: null },
    ];
    expect(readStageEquipmentItems(values)).toEqual([...items, { slot: "front_wheel", equipmentItemId: null, name: null }]);
    expect(combineEquipmentEffects(values.map(normalizeEquipmentEffects))).toEqual(combineEquipmentEffects([{ ratingBonuses: { mountain: 3 } }]));
  });
  it("shows contextual total bonuses separately from the net change, including negative changes and staff decimals", () => {
    const snapshot = buildStageEquipmentSnapshot({ items, stageType: "road", effects: combineEquipmentEffects([{ ratingBonuses: { mountain: 3.3, flat: 1, sprint: 2 }, timeTrialRatingBonuses: { timeTrial: 4 } }]), permanentEffects: combineEquipmentEffects([{ ratingBonuses: { mountain: 1.1, flat: 3, sprint: 2 } }]) });
    expect(snapshot?.ratingBonuses).toEqual({ mountain: 3.3, flat: 1, sprint: 2 });
    expect(snapshot?.ratingChanges).toEqual({ mountain: 2.2, flat: -2 });
  });
  it.each(["individual_time_trial", "team_time_trial", "prologue"] as const)("includes conditional bonuses on %s", (stageType) => {
    const snapshot = buildStageEquipmentSnapshot({ items, stageType, effects: combineEquipmentEffects([{ ratingBonuses: { timeTrial: 1 }, timeTrialRatingBonuses: { timeTrial: 3 } }]), permanentEffects: combineEquipmentEffects([{ timeTrialRatingBonuses: { timeTrial: 1 } }]) });
    expect(snapshot?.ratingBonuses.timeTrial).toBe(4);
    expect(snapshot?.ratingChanges.timeTrial).toBe(3);
  });
  it("does not create a badge without a recorded change", () => {
    expect(buildStageEquipmentSnapshot({ items: [], stageType: "road", effects: combineEquipmentEffects([]), permanentEffects: undefined })).toBeUndefined();
  });
  it("copies the item list so later changes cannot alter the receipt", () => {
    const source = items.map((item) => ({ ...item }));
    const snapshot = buildStageEquipmentSnapshot({ items: source, stageType: "road", effects: combineEquipmentEffects([]), permanentEffects: undefined });
    source[0].name = "Autre cadre";
    expect(snapshot?.items[0].name).toBe("Cadre des cols");
  });
});
