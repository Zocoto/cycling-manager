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
      cost: 0,
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
      cost: 0,
      durationDays: 20,
      costReductionPercentage: 0,
      durationReductionPercentage: 0,
    });
  });

  it("keeps complex courses longer but free", () => {
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

    expect(expert.cost).toBe(0);
    expect(beginner.cost).toBe(0);
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
      cost: 0,
      durationDays: 13,
      costReductionPercentage: 0,
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
      cost: 0,
      durationDays: 3,
      costReductionPercentage: 0,
      durationReductionPercentage: 50,
    });
  });

  it("never charges for any level or talent course, even with legacy cost bonuses", () => {
    for (const improvementType of ["level", "talent"] as const) {
      for (let staffLevel = 1; staffLevel <= 5; staffLevel++) {
        for (let talentCount = 0; talentCount <= 3; talentCount++) {
          const course = calculateStaffAcademyTraining({
            improvementType,
            staffLevel,
            talentCount,
            educatorBonuses: {
              activeEducatorCount: 1,
              costReductionPercentage: 40,
              durationReductionPercentage: 0,
              extraCapacity: 0,
            },
          });
          expect(course.cost).toBe(0);
          expect(course.costReductionPercentage).toBe(0);
          expect(course.durationDays).toBeGreaterThanOrEqual(5);
          expect(course.durationDays).toBeLessThanOrEqual(20);
        }
      }
    }
  });
});
