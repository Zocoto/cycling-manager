import { describe, expect, it } from "vitest";
import { calculateRiderSeasonSalary } from "./economy";
import { getRiderSalaryProfileScore, getRiderSalaryResultMultiplier, type SalaryRiderRatings } from "./rider-salary";

const ratings = (value: number): SalaryRiderRatings => ({ mountain:value,hills:value,flat:value,time_trial:value,cobbles:value,sprint:value,acceleration:value,downhill:value,endurance:value,resistance:value,recovery:value,breakaway:value,prologue:value });
describe("profile salary", () => {
  it("valorise un spécialiste plutôt qu’une simple moyenne identique", () => {
    const specialist = { ...ratings(40), sprint:80, acceleration:80, flat:60 };
    const mean = Object.values(specialist).reduce((a,b)=>a+b,0)/13;
    expect(calculateRiderSeasonSalary({ overall:mean, ratings:specialist })).toBeGreaterThan(calculateRiderSeasonSalary({ overall:mean, ratings:ratings(mean) }));
  });
  it("valorise aussi les qualités de soutien et ignore les métadonnées", () => {
    const helper = { ...ratings(50), flat:65, endurance:80, resistance:75, recovery:80 };
    expect(getRiderSalaryProfileScore(helper)).toBeGreaterThan(getRiderSalaryProfileScore(ratings(50)));
    const withMetadata = { ...helper, rider_id:"rider", age:31 };
    expect(getRiderSalaryProfileScore(withMetadata)).toBe(getRiderSalaryProfileScore(helper));
  });
  it("exige des résultats significatifs et plafonne leur prime à 25 %", () => {
    expect(getRiderSalaryResultMultiplier(.99,10)).toBe(1);
    expect(getRiderSalaryResultMultiplier(.9,50)).toBe(1.05);
    expect(getRiderSalaryResultMultiplier(.9,100)).toBe(1.1);
    expect(getRiderSalaryResultMultiplier(.96,300)).toBe(1.15);
    expect(getRiderSalaryResultMultiplier(1,1000)).toBe(1.25);
    expect(getRiderSalaryResultMultiplier(null,1000)).toBe(1);
  });
});
