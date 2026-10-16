import { describe, expect, it } from "vitest";
import { STAFF_DAILY_ROLE_DISTRIBUTION, calculateStaffSalary, getStaffEffectPercentage, isStaffRole } from "./staff";
import { getStaffTalentCodes, selectInitialStaffTalent, describeStaffTalent } from "./staff-talents";
import { getStaffAcademyTalentCapacity } from "./staff-academy";

describe("Directeur financier", () => {
  it("enters the existing market with exactly one initial affix at any level", () => {
    expect(isStaffRole("financial_director")).toBe(true);
    expect(STAFF_DAILY_ROLE_DISTRIBUTION).toContain("financial_director");
    const codes = getStaffTalentCodes("financial_director");
    expect(codes).toHaveLength(4);
    for (const level of [1,2,3,4,5]) for (let roll=0;roll<20;roll++) {
      const initial = selectInitialStaffTalent({ role: "financial_director", staffLevel: level, roll });
      expect(typeof initial).toBe("string");
      expect(codes).toContain(initial);
    }
  });
  it("unlocks capacity with level, never grants an automatic generic bonus", () => {
    expect([1,2,3,4,5].map(level => getStaffAcademyTalentCapacity("financial_director",level))).toEqual([1,2,3,3,3]);
    expect(getStaffAcademyTalentCapacity("trainer",1)).toBe(3);
    expect(getStaffEffectPercentage("financial_director",5)).toBe(0);
    expect(calculateStaffSalary("financial_director",1)).toBe(18000);
    expect(calculateStaffSalary("financial_director",5)).toBe(90000);
  });
  it("describes the actual bounded payout formulas", () => {
    expect(describeStaffTalent("finance_race_prizes",5)).toContain("+10 %");
    expect(describeStaffTalent("finance_main_sponsor",5)).toContain("+2.5 %");
    expect(describeStaffTalent("finance_secondary_sponsor",5)).toContain("+5 %");
    expect(describeStaffTalent("finance_daily_income",5)).toContain("+750 €");
    expect(28*750*1.1).toBeLessThan(calculateStaffSalary("financial_director",5));
  });
});
