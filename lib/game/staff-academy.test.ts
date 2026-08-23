import { describe, expect, it } from "vitest";

import {
  STAFF_ACADEMY_LEVELS,
  calculateStaffAcademyTraining,
  getStaffAcademyCapacity,
} from "@/lib/game/staff-academy";

describe("staff academy", () => {
  it("increases the simultaneous training capacity at every level", () => {
    expect(STAFF_ACADEMY_LEVELS.map((level) => level.capacity)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(getStaffAcademyCapacity(0)).toBe(0);
    expect(getStaffAcademyCapacity(5)).toBe(5);
  });

  it("starts a one-star, one-talent level course at five days", () => {
    expect(
      calculateStaffAcademyTraining({
        improvementType: "level",
        staffLevel: 1,
        talentCount: 1,
      }),
    ).toEqual({
      cost: 525_000,
      durationDays: 5,
      costReductionPercentage: 0,
      durationReductionPercentage: 0,
    });
  });

  it("caps the most complex courses at twenty days", () => {
    expect(
      calculateStaffAcademyTraining({
        improvementType: "talent",
        staffLevel: 5,
        talentCount: 2,
      }),
    ).toEqual({
      cost: 1_750_000,
      durationDays: 20,
      costReductionPercentage: 0,
      durationReductionPercentage: 0,
    });
  });

  it("makes additional levels and talent lines progressively expensive", () => {
    const beginner = calculateStaffAcademyTraining({
      improvementType: "level",
      staffLevel: 1,
      talentCount: 0,
    });
    const expert = calculateStaffAcademyTraining({
      improvementType: "level",
      staffLevel: 4,
      talentCount: 3,
    });

    expect(expert.cost).toBeGreaterThan(beginner.cost);
    expect(expert.durationDays).toBeGreaterThan(beginner.durationDays);
  });

  it("applique les réductions des formateurs aux prochains stages", () => {
    expect(
      calculateStaffAcademyTraining({
        improvementType: "talent",
        staffLevel: 5,
        talentCount: 2,
        educatorBonuses: {
          activeEducatorCount: 2,
          costReductionPercentage: 40,
          durationReductionPercentage: 35,
          extraCapacity: 1,
        },
      }),
    ).toEqual({
      cost: 1_050_000,
      durationDays: 13,
      costReductionPercentage: 40,
      durationReductionPercentage: 35,
    });
  });

  it("plafonne les réductions pédagogiques à cinquante pour cent", () => {
    expect(
      calculateStaffAcademyTraining({
        improvementType: "level",
        staffLevel: 1,
        talentCount: 1,
        educatorBonuses: {
          activeEducatorCount: 3,
          costReductionPercentage: 90,
          durationReductionPercentage: 80,
          extraCapacity: 1,
        },
      }),
    ).toEqual({
      cost: 275_000,
      durationDays: 3,
      costReductionPercentage: 50,
      durationReductionPercentage: 50,
    });
  });
});
