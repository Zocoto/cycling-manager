import { describe, expect, it } from "vitest";
import { TEAM_INFRASTRUCTURE_DEFINITIONS } from "./infrastructure";
import { getInfrastructureSpecializationProposal } from "./infrastructure-specializations";
import { getPerformancePreparationPolicy, TERRAIN_PREPARATION_SPECIALIZATIONS, isPerformancePreparationType, getPerformancePreparationCampName, PERFORMANCE_PREPARATION_FACILITIES } from "./performance-preparation";

describe("terrain preparation facilities", () => {
  for (const type of Object.keys(TERRAIN_PREPARATION_SPECIALIZATIONS) as Array<keyof typeof TERRAIN_PREPARATION_SPECIALIZATIONS>) {
    const codes = TERRAIN_PREPARATION_SPECIALIZATIONS[type];
    it(`${type} exposes exactly three orientations and a consistent camp label`, () => {
      expect(isPerformancePreparationType(type)).toBe(true);
      expect(getInfrastructureSpecializationProposal("team", type)?.options.map(option => option.code)).toEqual(codes);
      expect(getPerformancePreparationCampName(PERFORMANCE_PREPARATION_FACILITIES[type].campType)).toBe(PERFORMANCE_PREPARATION_FACILITIES[type].name);
    });
    it.each([1, 2, 3, 4, 5])(`${type} keeps each orientation exclusive at level %s`, level => {
      const base = getPerformancePreparationPolicy(level)!;
      const power = level < 3 ? 0 : level === 3 ? 0.6 : level === 4 ? 0.8 : 1;
      expect(getPerformancePreparationPolicy(level, { preparationType: type, specializationCode: codes[0] })).toEqual({ ...base, ratingBonus: base.ratingBonus + 0.5 * power });
      expect(getPerformancePreparationPolicy(level, { preparationType: type, specializationCode: codes[1] })).toEqual({ ...base, bonusDays: base.bonusDays + Math.floor(2 * power) });
      expect(getPerformancePreparationPolicy(level, { preparationType: type, specializationCode: codes[2] })).toEqual({ ...base, capacity: base.capacity + (level >= 3 ? 1 : 0) });
      expect(getPerformancePreparationPolicy(level, { preparationType: type, specializationCode: "unrelated" })).toEqual(base);
    });
  }
  it("orders every level price below track for PAV and above tunnel for VAL then MO", () => {
    for (let index = 0; index < 5; index++) {
      const cost = (type: keyof typeof TEAM_INFRASTRUCTURE_DEFINITIONS) => TEAM_INFRASTRUCTURE_DEFINITIONS[type].levels[index]!.cost;
      expect(cost("cobbles_center")).toBeLessThan(cost("indoor_track"));
      expect(cost("hills_circuit")).toBeGreaterThan(cost("wind_tunnel"));
      expect(cost("mountain_base")).toBeGreaterThan(cost("hills_circuit"));
    }
  });
  it("does not reinterpret existing track and tunnel orientations", () => {
    for (const preparationType of ["indoor_track", "wind_tunnel"] as const) {
      expect(getPerformancePreparationPolicy(5, { preparationType, specializationCode: "cobbles_precision" })).toEqual(getPerformancePreparationPolicy(5));
    }
    expect(isPerformancePreparationType("toString")).toBe(false);
  });
});
