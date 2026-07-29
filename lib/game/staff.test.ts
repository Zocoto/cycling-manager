import { describe, expect, it } from "vitest";

import {
  STAFF_DAILY_ROLE_DISTRIBUTION,
  STAFF_LEVEL_RARITY_WEIGHTS,
  STAFF_LEVEL_WEIGHT_TOTAL,
  STAFF_ROLES,
  calculateConstructionWithArchitect,
  calculateDueStaffSalary,
  calculateRemainingStaffSalary,
  calculateStaffDismissalCompensation,
  calculateStaffSalary,
  calculateStaffSigningFee,
  describeStaffEffect,
  getNutritionistDailyCapacity,
  getArchitectConstructionBonuses,
  getPhysiotherapistRiderCapacity,
  getScoutYouthBonuses,
  getStaffCapacityForDirectorLevel,
  selectStaffLevelFromRoll,
} from "@/lib/game/staff";

describe("staff economy", () => {
  it("keeps the requested salary hierarchy at an equal level", () => {
    const level = 3;

    expect(calculateStaffSalary("trainer", level)).toBeGreaterThan(
      calculateStaffSalary("scout", level),
    );
    expect(calculateStaffSalary("scout", level)).toBeGreaterThan(
      calculateStaffSalary("doctor", level),
    );
    expect(calculateStaffSalary("doctor", level)).toBeGreaterThan(
      calculateStaffSalary("mechanic", level),
    );
  });

  it("raises salary and signing fee with the staff level", () => {
    expect(calculateStaffSalary("trainer", 5)).toBeGreaterThan(
      calculateStaffSalary("trainer", 1),
    );
    expect(calculateStaffSigningFee("trainer", 5)).toBeGreaterThan(
      calculateStaffSigningFee("trainer", 1),
    );
  });

  it("makes five-star experts a genuine budget choice", () => {
    expect(calculateStaffSalary("trainer", 1)).toBe(22_000);
    expect(calculateStaffSalary("trainer", 3)).toBe(48_500);
    expect(calculateStaffSalary("trainer", 5)).toBe(110_000);
    expect(calculateStaffSigningFee("trainer", 5)).toBe(71_500);
  });

  it("uses a deliberately non-linear staff capacity curve", () => {
    expect(
      Array.from({ length: 11 }, (_, level) =>
        getStaffCapacityForDirectorLevel(level),
      ),
    ).toEqual([1, 1, 2, 3, 5, 7, 10, 13, 17, 21, 25]);
  });

  it("charges already elapsed weekly installments immediately", () => {
    expect(calculateDueStaffSalary(40_000, 1)).toBe(0);
    expect(calculateDueStaffSalary(40_000, 7)).toBe(10_000);
    expect(calculateDueStaffSalary(40_000, 21)).toBe(30_000);
    expect(calculateDueStaffSalary(40_000, 28)).toBe(40_000);
  });

  it("facture le salaire restant de la saison et toute la suivante", () => {
    expect(calculateRemainingStaffSalary(40_000, 1)).toBe(40_000);
    expect(calculateStaffDismissalCompensation(40_000, 1)).toBe(80_000);
    expect(calculateStaffDismissalCompensation(40_000, 7)).toBe(70_000);
    expect(calculateStaffDismissalCompensation(40_000, 14)).toBe(60_000);
    expect(calculateStaffDismissalCompensation(40_000, 21)).toBe(50_000);
    expect(calculateStaffDismissalCompensation(40_000, 28)).toBe(40_000);
  });

  it("expands physiotherapist capacity by useful non-linear steps", () => {
    expect(
      Array.from({ length: 5 }, (_, index) =>
        getPhysiotherapistRiderCapacity(index + 1),
      ),
    ).toEqual([2, 4, 6, 9, 12]);
  });

  it("augmente la capacité nutritionnelle quotidienne avec le niveau", () => {
    expect(
      Array.from({ length: 5 }, (_, index) =>
        getNutritionistDailyCapacity(index + 1),
      ),
    ).toEqual([2, 3, 4, 5, 6]);
  });

  it("applies distinct architect specialties to construction reductions", () => {
    expect(getArchitectConstructionBonuses(1)).toEqual({
      costReductionPercentage: 4,
      durationReductionPercentage: 4,
    });
    expect(getArchitectConstructionBonuses(5, "economist")).toEqual({
      costReductionPercentage: 30,
      durationReductionPercentage: 10,
    });
    expect(getArchitectConstructionBonuses(5, "foreman")).toEqual({
      costReductionPercentage: 10,
      durationReductionPercentage: 30,
    });

    expect(
      calculateConstructionWithArchitect({
        baseCost: 100_000,
        baseDurationDays: 20,
        architectLevel: 3,
        architectSpecialty: "balanced",
      }),
    ).toEqual({
      cost: 88_000,
      durationDays: 18,
      costReductionPercentage: 12,
      durationReductionPercentage: 12,
    });
  });

  it("improves youth potential and initial ratings with scout level", () => {
    expect(getScoutYouthBonuses(1)).toEqual({
      scoutingEfficiencyPercentage: 5,
      potentialBonus: 0.55,
      initialRatingBonus: 0.04,
    });
    expect(getScoutYouthBonuses(5)).toEqual({
      scoutingEfficiencyPercentage: 25,
      potentialBonus: 2.75,
      initialRatingBonus: 0.2,
    });
  });
});

describe("daily staff pool", () => {
  it("contains exactly 25 jobs and exposes every profession", () => {
    expect(STAFF_DAILY_ROLE_DISTRIBUTION).toHaveLength(25);
    for (const role of STAFF_ROLES) {
      expect(STAFF_DAILY_ROLE_DISTRIBUTION).toContain(role);
    }
  });

  it("makes every additional star rarer than the previous one", () => {
    expect(STAFF_LEVEL_WEIGHT_TOTAL).toBe(100);
    expect(STAFF_LEVEL_RARITY_WEIGHTS.map(({ weight }) => weight)).toEqual([
      50, 28, 15, 6, 1,
    ]);
  });

  it("maps the weighted rarity boundaries to the expected staff levels", () => {
    expect(
      [0, 49, 50, 77, 78, 92, 93, 98, 99].map(
        selectStaffLevelFromRoll,
      ),
    ).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it("applies the requested +2 to +10 percent reputation scale", () => {
    expect(
      Array.from({ length: 5 }, (_, index) =>
        describeStaffEffect({
          role: "community_manager",
          level: index + 1,
        })[0],
      ),
    ).toEqual([
      "+2 % sur tous les gains de réputation",
      "+4 % sur tous les gains de réputation",
      "+6 % sur tous les gains de réputation",
      "+8 % sur tous les gains de réputation",
      "+10 % sur tous les gains de réputation",
    ]);
  });
});
