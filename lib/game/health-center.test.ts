import { describe, expect, it } from "vitest";

import {
  getFormCampTotal,
  getNutritionInterventionOutcome,
  getNutritionistDailyRecoveryBonus,
  getProtocolRecoveryReductionHours,
  resolveCrashMedicalOutcome,
} from "./health-center";

describe("resolveCrashMedicalOutcome", () => {
  it("laisse 80 % des chutes sans blessure avant protection", () => {
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0.2) })
    ).toBeNull();
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0.199, 0.2, 0.9) })
        ?.diagnosisCode
    ).toBe("rib_fracture");
  });

  it("respecte la répartition côtes, poignet et clavicule", () => {
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.49, 0.99) })
        ?.diagnosisCode
    ).toBe("rib_fracture");
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.5, 0.99) })
        ?.diagnosisCode
    ).toBe("wrist_fracture");
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.8, 0.99) })
        ?.diagnosisCode
    ).toBe("clavicle_fracture");
  });

  it("rend la clavicule toujours éliminatoire et les côtes parfois non", () => {
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.9, 0.99) })
        ?.causesAbandonment
    ).toBe(true);
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.2, 0.99) })
        ?.causesAbandonment
    ).toBe(false);
  });

  it("réduit le risque global grâce au matériel", () => {
    expect(
      resolveCrashMedicalOutcome({
        random: sequence(0.15),
        injuryRiskReductionPct: 45,
      })
    ).toBeNull();
  });
});

describe("health center rules", () => {
  it("calcule des réductions médicales proportionnelles", () => {
    expect(
      getProtocolRecoveryReductionHours({
        recoveryHours: 72,
        durationReductionPct: 10,
      })
    ).toBe(8);
    expect(
      getProtocolRecoveryReductionHours({
        recoveryHours: 96,
        durationReductionPct: 10,
      })
    ).toBe(10);
    expect(
      getProtocolRecoveryReductionHours({
        recoveryHours: 120,
        durationReductionPct: 10,
      })
    ).toBe(12);
  });

  it("calcule le coût et le gain des stages", () => {
    expect(getFormCampTotal({ type: "classic", durationDays: 3 })).toEqual({
      durationDays: 3,
      totalFormGain: 15,
      totalPrice: 6_000,
    });
    expect(getFormCampTotal({ type: "premium", durationDays: 2 })).toEqual({
      durationDays: 2,
      totalFormGain: 20,
      totalPrice: 12_000,
    });
  });

  it("améliore et réduit le prix des interventions nutritionnelles avec le niveau", () => {
    expect(
      getNutritionInterventionOutcome({
        code: "recovery_snack",
        nutritionistLevel: 1,
      }),
    ).toEqual({ formGain: 3, price: 1_425, discountPct: 5, isUnlocked: true });
    expect(
      getNutritionInterventionOutcome({
        code: "tailored_plan",
        nutritionistLevel: 3,
      }),
    ).toEqual({ formGain: 6, price: 2_975, discountPct: 15, isUnlocked: true });
    expect(
      getNutritionInterventionOutcome({
        code: "elite_recharge",
        nutritionistLevel: 4,
      }).isUnlocked,
    ).toBe(false);
  });

  it("répartit le bonus passif du nutritionniste sans perdre les fractions", () => {
    expect(
      Array.from({ length: 5 }, (_, index) =>
        getNutritionistDailyRecoveryBonus({
          nutritionistLevel: 3,
          dayNumber: index + 1,
        }),
      ),
    ).toEqual([0, 1, 0, 1, 1]);
  });
});

function sequence(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
