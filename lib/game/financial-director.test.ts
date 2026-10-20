import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { STAFF_DAILY_ROLE_DISTRIBUTION, calculateStaffSalary, getStaffEffectPercentage, getFinancialDirectorDailyIncome, describeStaffEffect, isStaffRole } from "./staff";
import { STAFF_TALENT_DEFINITIONS, getStaffTalentCodes, selectInitialStaffTalent, describeStaffTalent } from "./staff-talents";
import { getStaffAcademyTalentCapacity } from "./staff-academy";

describe("Directeur financier", () => {
  it("enters the existing market with exactly one initial affix at any level", () => {
    expect(isStaffRole("financial_director")).toBe(true);
    expect(STAFF_DAILY_ROLE_DISTRIBUTION).toContain("financial_director");
    const codes = getStaffTalentCodes("financial_director");
    expect(codes).toHaveLength(5);
    for (const level of [1,2,3,4,5]) for (let roll=0;roll<20;roll++) {
      const initial = selectInitialStaffTalent({ role: "financial_director", staffLevel: level, roll });
      expect(typeof initial).toBe("string");
      expect(codes).toContain(initial);
    }
  });
  it("unlocks affix capacity with level and has no generic percentage bonus", () => {
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
    expect(STAFF_TALENT_DEFINITIONS.finance_daily_income.label).toBe("Optimisation des charges");
    expect(describeStaffTalent("finance_daily_income",5)).toContain("−10 %");
    expect(describeStaffTalent("finance_daily_income",5)).toContain("hors salaire du Directeur financier");
    expect(describeStaffTalent("finance_rider_salary",5)).toContain("−10 %");
    expect(describeStaffTalent("finance_rider_salary",5)).toContain("des coureurs");
  });
  it("provides a progressive base income independently of the recruited affix", () => {
    expect([1,2,3,4,5].map(getFinancialDirectorDailyIncome)).toEqual([200,450,850,1600,2900]);
    let previousCoverage = 0;
    for (const level of [1,2,3,4,5]) {
      const income = getFinancialDirectorDailyIncome(level);
      const coverage = income * 28 / calculateStaffSalary("financial_director",level);
      expect(coverage).toBeGreaterThan(previousCoverage);
      expect(coverage).toBeLessThan(1);
      expect(describeStaffEffect({ role: "financial_director", level })[0]).toContain(`+${income} €`);
      previousCoverage = coverage;
    }
    expect(getFinancialDirectorDailyIncome(0)).toBe(200);
    expect(getFinancialDirectorDailyIncome(99)).toBe(2900);
    expect(getFinancialDirectorDailyIncome(Number.NaN)).toBe(200);
    const migration=readFileSync("supabase/migrations/20261020100000_financial_director_base_income_and_salary_savings.sql","utf8");
    expect(migration).toContain(`array[${[1,2,3,4,5].map(getFinancialDirectorDailyIncome).join(",")}]`);
  });
  it("draws each of the five complementary affixes equally, never the base income", () => {
    const distribution = new Map<string, number>();
    for (let roll=0;roll<500;roll++) {
      const code=selectInitialStaffTalent({role:"financial_director",staffLevel:5,roll});
      distribution.set(code,(distribution.get(code)??0)+1);
    }
    expect([...distribution.values()]).toEqual([100,100,100,100,100]);
  });
});
