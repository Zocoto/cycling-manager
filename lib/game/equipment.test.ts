import { describe, expect, it } from "vitest";

import {
  applyEquipmentRatingBonuses,
  combineEquipmentEffects,
  equipmentMatchesEffect,
  getEquipmentRatingBonusTotals,
  isEquipmentEffectFilterKey,
  isEquipmentChangeFrozenForRace,
  isPersistedEquipmentAssignmentCompatible,
  isEquipmentSlotCompatible,
} from "./equipment";
import type { RiderRatings } from "./rider-profile";

const ratings: RiderRatings = {
  mountain: 80,
  hills: 80,
  recovery: 80,
  endurance: 80,
  resistance: 80,
  breakaway: 80,
  downhill: 80,
  acceleration: 80,
  sprint: 80,
  flat: 80,
  cobbles: 80,
  prologue: 80,
  timeTrial: 99,
};

describe("equipment slot compatibility", () => {
  it("keeps ordinary equipment restricted to its own slot", () => {
    expect(
      isEquipmentSlotCompatible({
        targetSlot: "front_wheel",
        itemSlot: "rear_wheel",
      }),
    ).toBe(false);
    expect(
      isEquipmentSlotCompatible({
        targetSlot: "helmet",
        itemSlot: "helmet",
      }),
    ).toBe(true);
  });

  it("allows only front and rear wheels to cross when the talent is active", () => {
    expect(
      isEquipmentSlotCompatible({
        targetSlot: "front_wheel",
        itemSlot: "rear_wheel",
        canSwapWheelSlots: true,
      }),
    ).toBe(true);
    expect(
      isEquipmentSlotCompatible({
        targetSlot: "rear_wheel",
        itemSlot: "front_wheel",
        canSwapWheelSlots: true,
      }),
    ).toBe(true);
    expect(
      isEquipmentSlotCompatible({
        targetSlot: "frame",
        itemSlot: "front_wheel",
        canSwapWheelSlots: true,
      }),
    ).toBe(false);
  });

  it("relit les deux roues identiques dans leurs emplacements persistés", () => {
    const climbFeatherEffects = {
      ratingBonuses: { mountain: 2, hills: 1 },
    };
    const persistedAssignments = [
      { assignmentSlot: "front_wheel", itemSlot: "rear_wheel" },
      { assignmentSlot: "rear_wheel", itemSlot: "rear_wheel" },
    ] as const;

    const combined = combineEquipmentEffects(
      persistedAssignments.flatMap((assignment) =>
        isPersistedEquipmentAssignmentCompatible(assignment)
          ? [climbFeatherEffects]
          : [],
      ),
    );

    expect(getEquipmentRatingBonusTotals(combined)).toMatchObject({
      mountain: 4,
      hills: 2,
    });
    expect(
      isPersistedEquipmentAssignmentCompatible({
        assignmentSlot: "frame",
        itemSlot: "rear_wheel",
      }),
    ).toBe(false);
  });
});

describe("equipment effects", () => {
  it("cumule les bonus de chaque pièce et plafonne la protection", () => {
    expect(
      combineEquipmentEffects([
        {
          ratingBonuses: { mountain: 2, acceleration: 1 },
          injuryRiskReductionPct: 30,
        },
        {
          ratingBonuses: { mountain: 1, timeTrial: 3 },
          injuryRiskReductionPct: 25,
          victoryReputationBonus: 0.2,
        },
      ])
    ).toEqual({
      ratingBonuses: { mountain: 3, acceleration: 1, timeTrial: 3 },
      timeTrialRatingBonuses: {},
      injuryRiskReductionPct: 45,
      breakawayReputationBonus: 0,
      victoryReputationBonus: 0.2,
    });
  });

  it("additionne les bonus généraux et contextuels dans un seul total affiché", () => {
    expect(
      getEquipmentRatingBonusTotals({
        ratingBonuses: { timeTrial: 2, acceleration: 2 },
        timeTrialRatingBonuses: {
          timeTrial: 2,
          acceleration: 1,
          endurance: 1,
        },
      })
    ).toEqual({
      timeTrial: 4,
      acceleration: 3,
      endurance: 1,
    });
  });

  it("réserve les bonus contextuels aux chronos et prologues", () => {
    const effects = {
      ratingBonuses: {},
      timeTrialRatingBonuses: { endurance: 2 },
    };

    expect(applyEquipmentRatingBonuses(ratings, effects).endurance).toBe(80);
    expect(
      applyEquipmentRatingBonuses(ratings, effects, { isTimeTrial: true })
        .endurance
    ).toBe(82);
  });

  it("filtre le matériel sur ses gains réels, y compris en chrono", () => {
    const effects = {
      ratingBonuses: { mountain: 2 },
      timeTrialRatingBonuses: { timeTrial: 3, endurance: 1 },
      injuryRiskReductionPct: 4,
      breakawayReputationBonus: 0,
      victoryReputationBonus: 0.2,
    };

    expect(equipmentMatchesEffect(effects, "mountain")).toBe(true);
    expect(equipmentMatchesEffect(effects, "timeTrial")).toBe(true);
    expect(equipmentMatchesEffect(effects, "endurance")).toBe(true);
    expect(equipmentMatchesEffect(effects, "injuryRisk")).toBe(true);
    expect(equipmentMatchesEffect(effects, "breakawayReputation")).toBe(false);
    expect(equipmentMatchesEffect(effects, "victoryReputation")).toBe(true);
    expect(isEquipmentEffectFilterKey("timeTrial")).toBe(true);
    expect(isEquipmentEffectFilterKey("inconnu")).toBe(false);
  });

  it("autorise le matériel à déplacer le plafond au-delà de 100", () => {
    const boosted = applyEquipmentRatingBonuses(ratings, {
      ratingBonuses: { mountain: 2, timeTrial: 4 },
    });

    expect(boosted.mountain).toBe(82);
    expect(boosted.timeTrial).toBe(103);
  });

  it("gèle les changements cinq minutes avant chaque course", () => {
    const earlyRace = {
      departureAt: new Date("2026-07-20T12:00:00Z"),
      durationMinutes: 25,
    };
    const lateRace = {
      departureAt: new Date("2026-07-20T16:00:00Z"),
      durationMinutes: 30,
    };

    expect(
      isEquipmentChangeFrozenForRace({
        ...earlyRace,
        now: new Date("2026-07-20T11:54:59Z"),
      })
    ).toBe(false);
    expect(
      isEquipmentChangeFrozenForRace({
        ...earlyRace,
        now: new Date("2026-07-20T11:55:00Z"),
      })
    ).toBe(true);
    expect(
      isEquipmentChangeFrozenForRace({
        ...earlyRace,
        now: new Date("2026-07-20T12:25:00Z"),
      })
    ).toBe(false);
    expect(
      isEquipmentChangeFrozenForRace({
        ...lateRace,
        now: new Date("2026-07-20T15:55:00Z"),
      })
    ).toBe(true);
  });
});
