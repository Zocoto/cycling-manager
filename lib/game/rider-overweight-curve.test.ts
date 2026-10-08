import { describe, expect, it } from "vitest";
import {
  getRiderPhysiologyProfileModifier,
  getRiderPhysiologyTerrainModifier,
  getRiderWeightThreshold,
  RIDER_OVERWEIGHT_RULES,
  type RiderPhysiology,
  type RiderPhysiologyProfile,
} from "./rider-physiology";
import type { RiderSimulationRatings } from "./race-simulation";

const ratings: RiderSimulationRatings = {
  mountain: 50, hills: 50, flat: 50, timeTrial: 50, cobbles: 50,
  sprint: 50, acceleration: 50, downhill: 50, endurance: 50,
  resistance: 50, recovery: 50, breakaway: 50, prologue: 50,
};
const terrains = ["cobbles", "flat", "sprint", "time_trial"] as const;
const profiles: RiderPhysiologyProfile[] = [
  "climber", "puncheur", "stage_racer", "northern_classics",
  "rouleur", "breakaway", "sprinter", "all_rounder",
];
const clamp = (n: number, cap: number) => Math.min(cap, Math.max(-cap, n));
const physiology = (profile: RiderPhysiologyProfile, heightCm: number, bmi: number,
  baselineWeightKg = 60, physiologyVersion = 0): RiderPhysiology => ({
  heightCm, weightKg: bmi * (heightCm / 100) ** 2,
  baselineWeightKg, physiologyVersion, naturalProfile: profile,
});
const modifier = (body: RiderPhysiology, profileType: typeof terrains[number]) =>
  getRiderPhysiologyProfileModifier({ physiology: body, ratings, profileType });

describe("approved power-terrain overweight curve", () => {
  it.each(terrains)("freezes then halves then removes the %s bonus without a boundary jump", (terrain) => {
    const threshold = getRiderWeightThreshold("sprinter", 180).maximumBodyMassIndex;
    const at = (offset: number) => modifier(physiology("sprinter", 180, threshold + offset), terrain);
    expect(at(0)).toBeGreaterThan(0);
    expect(at(1)).toBeCloseTo(at(0) / 2, 10);
    expect(at(2)).toBeCloseTo(0, 10);
    expect(at(0.000001)).toBeCloseTo(at(0), 5);
    expect(at(1.999999)).toBeCloseTo(at(2.000001), 5);
  });

  it.each(terrains)("uses the validated slope and maximum negative modifier for %s", (terrain) => {
    const rule = RIDER_OVERWEIGHT_RULES[terrain === "sprint" ? "flat" : terrain];
    const threshold = getRiderWeightThreshold("sprinter", 180).maximumBodyMassIndex;
    expect(modifier(physiology("sprinter", 180, threshold + 3), terrain)).toBeCloseTo(-rule.penaltyPerBmi, 10);
    expect(modifier(physiology("sprinter", 180, threshold + 30), terrain)).toBe(-rule.maximumPenalty);
  });

  it.each([
    ["northern_classics", "cobbles", -2.43354788069073],
    ["sprinter", "sprint", -2.79715136898752],
    ["rouleur", "time_trial", -4],
  ] as const)("matches the communicated BMI 30 example for %s", (profile, terrain, expected) => {
    const threshold = getRiderWeightThreshold(profile, 180).maximumBodyMassIndex;
    const rule = RIDER_OVERWEIGHT_RULES[terrain === "sprint" ? "flat" : terrain];
    const exactExpected = -Math.min(rule.maximumPenalty, (30 - threshold - 2) * rule.penaltyPerBmi);
    expect(modifier(physiology(profile, 180, 30), terrain)).toBeCloseTo(exactExpected, 10);
    expect(Number(exactExpected.toFixed(1))).toBe(Number(expected.toFixed(1)));
  });

  it("never rewards further weight gain beyond the threshold, across all profiles, sizes and legacy baselines", () => {
    for (const profile of profiles) for (const height of [150, 170, 180, 200]) {
      const threshold = getRiderWeightThreshold(profile, height).maximumBodyMassIndex;
      for (const baseline of [45, 65, 85, 110]) for (const version of [0, 1]) for (const terrain of terrains) {
        let previous = modifier(physiology(profile, height, threshold, baseline, version), terrain);
        for (let step = 1; step <= 100; step++) {
          const body = physiology(profile, height, threshold + step / 10, baseline, version);
          const next = modifier(body, terrain);
          expect(next).toBeLessThanOrEqual(previous + 1e-9);
          previous = next;
        }
      }
    }
  });

  it("preserves the old formulas below the threshold, including legacy neutrality", () => {
    for (const terrain of terrains) for (const height of [170, 180, 195]) {
      const body = physiology("sprinter", height, 20, 65);
      const delta = body.weightKg - body.baselineWeightKg;
      const [coefficient, cap] = terrain === "cobbles" ? [0.2, 2.2] :
        terrain === "time_trial" ? [0.08, 1.6] : [0.14, 1.8];
      expect(modifier(body, terrain)).toBeCloseTo(clamp(delta * coefficient, cap), 10);
      expect(modifier({ ...body, weightKg: 65 }, terrain)).toBe(0);
    }
  });

  it("never erases an already negative modifier, even when the legacy baseline is overweight", () => {
    for (const terrain of terrains) {
      const threshold = getRiderWeightThreshold("sprinter", 180).maximumBodyMassIndex;
      const body = physiology("sprinter", 180, threshold + 1, 100);
      const old = terrain === "cobbles" ? clamp((body.weightKg - 100) * 0.2, 2.2) :
        terrain === "time_trial" ? clamp((body.weightKg - 100) * 0.08, 1.6) : clamp((body.weightKg - 100) * 0.14, 1.8);
      expect(modifier(body, terrain)).toBeLessThanOrEqual(old);
      expect(modifier({ ...body, weightKg: 100 }, terrain)).toBeLessThan(0);
    }
  });

  it("keeps mountain, hills and asphalt climbs exactly unchanged, including extreme weights", () => {
    for (const weight of [45, 60, 90, 120]) {
      const body = { ...physiology("climber", 170, 20), weightKg: weight, baselineWeightKg: 59 };
      expect(getRiderPhysiologyProfileModifier({ physiology: body, ratings, profileType: "mountain" })).toBe(clamp(-(weight - 59) * 0.62, 4.5));
      expect(getRiderPhysiologyProfileModifier({ physiology: body, ratings, profileType: "hilly" })).toBe(clamp(-(weight - 59) * 0.36, 3));
      const segment = { terrain: "climb", surface: "asphalt", distanceKm: 15, averageGradientPct: 8 } as const;
      const difficulty = Math.min(1.45, Math.max(0.7, 0.62 + 8 / 14 + 15 / 45));
      expect(getRiderPhysiologyTerrainModifier({ physiology: body, ratings, segment })).toBeCloseTo(clamp(-(weight - 59) * 0.56 * difficulty, 4.5), 10);
    }
  });

  it("applies the same continuous rule on cobbled and flat sectors and retains gravel attenuation", () => {
    const threshold = getRiderWeightThreshold("sprinter", 180).maximumBodyMassIndex;
    for (const surface of ["asphalt", "cobbles", "gravel"] as const) {
      const at = (offset: number) => getRiderPhysiologyTerrainModifier({
        physiology: physiology("sprinter", 180, threshold + offset), ratings,
        segment: { terrain: "flat", surface, distanceKm: 8, averageGradientPct: 0 },
      });
      expect(at(1)).toBeCloseTo(at(0) / 2, 10);
      expect(at(2)).toBeCloseTo(0, 10);
      expect(at(3)).toBeCloseTo(surface === "asphalt" ? -0.8 : surface === "cobbles" ? -0.6 : -0.6 * 0.68, 10);
    }
  });

  it("locks the natural profile independently of equipment-adjusted ratings", () => {
    const body = physiology("sprinter", 180, 25);
    expect(getRiderPhysiologyProfileModifier({ physiology: body, ratings, profileType: "flat" }))
      .toBe(getRiderPhysiologyProfileModifier({ physiology: body, ratings: { ...ratings, mountain: 130 }, profileType: "flat" }));
  });

  it("leaves absent/invalid physiology neutral", () => {
    expect(getRiderPhysiologyProfileModifier({ ratings, profileType: "flat" })).toBe(0);
    expect(modifier({ ...physiology("sprinter", 180, 30), weightKg: Number.NaN }, "flat")).toBe(0);
  });
});
