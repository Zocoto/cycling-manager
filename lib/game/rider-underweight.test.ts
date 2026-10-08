import { describe, expect, it } from "vitest";
import { getRiderMinimumPowerWeight, getRiderPhysiologyProfileModifier, getRiderPhysiologyTerrainModifier,
  type RiderPhysiology, type RiderPhysiologyProfile } from "./rider-physiology";
import { getRiderWeightStatus, getRiderWeightStatusLabel } from "./rider-weight-status";
const ratings = { mountain: 50, hills: 50, flat: 50, timeTrial: 50, cobbles: 50, sprint: 50,
  acceleration: 50, downhill: 50, endurance: 50, resistance: 50, recovery: 50, breakaway: 50, prologue: 50 };
const terrains = ["cobbles", "flat", "sprint", "time_trial"] as const;
const powerProfiles = ["rouleur", "northern_classics", "sprinter"] as const;
function body(profile: RiderPhysiologyProfile, height: number, deficit: number, version = 0, positive = false): RiderPhysiology {
  const bmi = getRiderMinimumPowerWeight(profile, height)!.minimumBodyMassIndex;
  const weight = (bmi - deficit) * (height / 100) ** 2;
  return {heightCm: height, weightKg: weight, baselineWeightKg: positive ? weight - 10 : weight,
    physiologyVersion: version, naturalProfile: profile};
}
const mod = (physiology: RiderPhysiology, profileType: typeof terrains[number]) =>
  getRiderPhysiologyProfileModifier({physiology, ratings, profileType});
describe("underweight power specialists", () => {
  it("uses native expertise and exact tenth-of-kilo thresholds", () => {
    for (const [key, profile] of [["timeTrial", "rouleur"], ["cobbles", "northern_classics"], ["sprint", "sprinter"]] as const) {
      const minimum = getRiderMinimumPowerWeight(profile, 180)!;
      const status = (weight: number) => getRiderWeightStatus({heightCm: 180, weightKg: weight, ratings: {...ratings, [key]: 95}})!;
      expect(status(minimum.minimumWeightKg).isUnderweight).toBe(false);
      const under = status(minimum.minimumWeightKg - 0.1);
      expect(under.isUnderweight).toBe(true);
      expect(under.isOverweight).toBe(false);
      expect(getRiderWeightStatusLabel(under)).toContain("Sous-poids");
      expect(getRiderWeightStatusLabel(under)).toContain("puissance");
    }
    expect(getRiderWeightStatus({heightCm: 180, weightKg: 55, ratings: {...ratings, mountain: 95}})!.isUnderweight).toBe(false);
    expect(getRiderMinimumPowerWeight("puncheur", 180)).toBeNull();
  });
  it("penalizes legacy neutral bodies immediately and caps extreme deficits", () => {
    for (const profile of powerProfiles) for (const terrain of terrains) {
      const slope = terrain === "cobbles" ? 0.6 : terrain === "time_trial" ? 1 : 0.8;
      expect(mod(body(profile, 180, 0), terrain)).toBeCloseTo(0, 10);
      expect(mod(body(profile, 180, 0.5), terrain)).toBeCloseTo(-slope / 2, 10);
      expect(mod(body(profile, 180, 7), terrain)).toBe(terrain === "cobbles" ? -3 : -4);
    }
  });
  it("is continuous and never rewards more weight loss below the threshold", () => {
    for (const profile of powerProfiles) for (const height of [160,180,200])
      for (const version of [0,1]) for (const positive of [false,true]) for (const terrain of terrains) {
        const threshold = body(profile,height,0,version,positive);
        const base = threshold.baselineWeightKg;
        const at = (deficit: number) => mod({...body(profile,height,deficit,version), baselineWeightKg: base},terrain);
        expect(at(1e-8)).toBeCloseTo(at(0),6);
        let previous = at(0);
        for (let n=1;n<=60;n++) {
          if (body(profile,height,n/10).weightKg < 40) break;
          const current = at(n/10); expect(current).toBeLessThanOrEqual(previous+1e-9); previous=current;
        }
      }
  });
  it("attenuates gravel penalties and leaves mountain and hilly handling unchanged", () => {
    const physiology = body("sprinter",180,2);
    const common = {terrain: "flat", distanceKm: 8, averageGradientPct: 0} as const;
    expect(getRiderPhysiologyTerrainModifier({physiology,ratings,segment:{...common,surface:"gravel"}})).toBeCloseTo(-1.2*0.68,10);
    expect(getRiderPhysiologyTerrainModifier({physiology,ratings,segment:{...common,surface:"cobbles"}})).toBeCloseTo(-1.2,10);
    for (const profileType of ["mountain","hilly"] as const)
      expect(getRiderPhysiologyProfileModifier({physiology,ratings,profileType})).toBe(0);
    expect(getRiderPhysiologyProfileModifier({physiology,ratings:{...ratings,mountain:130},profileType:"flat"})).toBe(mod(physiology,"flat"));
  });
});
