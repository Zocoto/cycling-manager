import { describe, expect, it } from "vitest";

import {
  STAFF_DAILY_LEVEL_DISTRIBUTION,
  STAFF_DAILY_ROLE_DISTRIBUTION,
  STAFF_ROLES,
  calculateDueStaffSalary,
  calculateStaffSalary,
  calculateStaffSigningFee,
  describeStaffEffect,
  getNutritionistDailyCapacity,
  getPhysiotherapistRiderCapacity,
  getStaffCapacityForDirectorLevel,
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
});

describe("daily staff pool", () => {
  it("contains exactly 25 jobs and exposes every profession", () => {
    expect(STAFF_DAILY_ROLE_DISTRIBUTION).toHaveLength(25);
    for (const role of STAFF_ROLES) {
      expect(STAFF_DAILY_ROLE_DISTRIBUTION).toContain(role);
    }
  });

  it("contains exactly 25 levels, including two elite profiles", () => {
    expect(STAFF_DAILY_LEVEL_DISTRIBUTION).toHaveLength(25);
    expect(STAFF_DAILY_LEVEL_DISTRIBUTION.filter((level) => level === 5)).toHaveLength(2);
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
