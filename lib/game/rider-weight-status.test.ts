import { describe, expect, it } from "vitest";
import { getRiderWeightStatus, getRiderWeightStatusLabel } from "./rider-weight-status";
import type { RiderRatings } from "./rider-profile";

const ratings: RiderRatings = {
  mountain: 50, hills: 50, flat: 50, timeTrial: 50, cobbles: 50,
  sprint: 50, acceleration: 50, downhill: 50, endurance: 50,
  resistance: 50, recovery: 50, breakaway: 50, prologue: 50,
};
const climber = { ...ratings, mountain: 95 };

describe("profile-specific sporting weight warning", () => {
  it.each([
    ["mountain", "climber", 170, 59], ["hills", "puncheur", 175, 66],
    ["timeTrial", "rouleur", 183, 74], ["cobbles", "northern_classics", 182, 76],
    ["sprint", "sprinter", 181, 77], ["breakaway", "breakaway", 176, 66],
  ] as const)("keeps reference %s riders below their own threshold", (key, profile, heightCm, weightKg) => {
    const status = getRiderWeightStatus({ heightCm, weightKg, ratings: { ...ratings, [key]: 95 } });
    expect(status?.profile).toBe(profile);
    expect(status?.isOverweight).toBe(false);
    expect(status!.maximumWeightKg).toBeGreaterThan(weightKg);
  });

  it("warns a climber but not a sprinter with identical height/weight", () => {
    expect(getRiderWeightStatus({ heightCm: 175, weightKg: 70, ratings: climber })?.isOverweight).toBe(true);
    expect(getRiderWeightStatus({ heightCm: 175, weightKg: 70, ratings: { ...ratings, sprint: 95 } })?.isOverweight).toBe(false);
  });

  it("scales the permitted weight with height and tests the real displayed boundary", () => {
    const status = getRiderWeightStatus({ heightCm: 170, weightKg: 59, ratings: climber })!;
    expect(status.maximumWeightKg).toBe(60.4);
    expect(getRiderWeightStatus({ heightCm: 170, weightKg: 60.4, ratings: climber })?.isOverweight).toBe(false);
    expect(getRiderWeightStatus({ heightCm: 170, weightKg: 60.5, ratings: climber })?.isOverweight).toBe(true);
    expect(getRiderWeightStatus({ heightCm: 180, weightKg: 60.5, ratings: climber })?.isOverweight).toBe(false);
    expect(getRiderWeightStatus({ heightCm: 180, weightKg: 59, ratings: climber })!.maximumWeightKg).toBeGreaterThan(status.maximumWeightKg);
  });

  it("clears the warning on weight loss and exposes the profile/threshold for explanation", () => {
    const status = getRiderWeightStatus({ heightCm: 170, weightKg: 61, ratings: climber })!;
    expect(getRiderWeightStatusLabel(status)).toContain("Surpoids pour le profil Grimpeur");
    expect(getRiderWeightStatusLabel(status)).toContain("60,4 kg");
    expect(getRiderWeightStatus({ heightCm: 170, weightKg: 60, ratings: climber })?.isOverweight).toBe(false);
  });

  it("does not invent alerts for missing, hidden or invalid data", () => {
    for (const heightCm of [null, Number.NaN, Number.POSITIVE_INFINITY, 0, 211]) {
      expect(getRiderWeightStatus({ heightCm, weightKg: 61, ratings: climber })).toBeNull();
    }
    for (const weightKg of [null, Number.NaN, 0, 121]) {
      expect(getRiderWeightStatus({ heightCm: 170, weightKg, ratings: climber })).toBeNull();
    }
    expect(getRiderWeightStatus({ heightCm: 170, weightKg: 61, ratings: null })).toBeNull();
    expect(getRiderWeightStatus({ heightCm: 170, weightKg: 61, ratings: { ...climber, mountain: Number.NaN } })).toBeNull();
  });

  it("distinguishes fading bonuses from penalties using the unrounded BMI", () => {
    const sprinter = { ...ratings, sprint: 95 };
    expect(getRiderWeightStatus({ heightCm: 180, weightKg: 79.3, ratings: sprinter })?.overweightPhase).toBe("none");
    const reduced = getRiderWeightStatus({ heightCm: 180, weightKg: 79.4, ratings: sprinter })!;
    expect(reduced.overweightPhase).toBe("reduced_bonus");
    expect(getRiderWeightStatusLabel(reduced)).toContain("bonus réduit");
    expect(getRiderWeightStatus({ heightCm: 180, weightKg: 85.8, ratings: sprinter })?.overweightPhase).toBe("reduced_bonus");
    const penalty = getRiderWeightStatus({ heightCm: 180, weightKg: 85.9, ratings: sprinter })!;
    expect(penalty.overweightPhase).toBe("penalty");
    expect(getRiderWeightStatusLabel(penalty)).toContain("malus sur pavés, plat/sprint et CLM");
  });
});
