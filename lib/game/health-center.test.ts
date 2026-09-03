import { describe, expect, it } from "vitest";

import {
  getDoctorFormCampBoostPct,
  getFormCampGainPerDay,
  getFormCampTotal,
  getNutritionInterventionOutcome,
  getNutritionistDailyRecoveryBonus,
  getProtocolRecoveryReductionHours,
  orderNutritionRidersByForm,
  resolveCrashMedicalOutcome,
  resolveRiderFormChange,
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
  it("bloque la forme a zero et cree trois jours de blessure sous zero", () => {
    expect(resolveRiderFormChange({ formBefore: 8, formDelta: -10 })).toEqual({
      form: 0,
      causesFatigueInjury: true,
      fatigueInjuryHours: 72,
    });
  });

  it("ne blesse pas un coureur dont la forme atteint exactement zero", () => {
    expect(resolveRiderFormChange({ formBefore: 10, formDelta: -10 })).toEqual({
      form: 0,
      causesFatigueInjury: false,
      fatigueInjuryHours: 0,
    });
  });

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
      totalFormGain: 30,
      totalPrice: 6_000,
    });
    expect(getFormCampTotal({ type: "premium", durationDays: 2 })).toEqual({
      durationDays: 2,
      totalFormGain: 40,
      totalPrice: 12_000,
    });
  });

  it("renforce les stages de 5 % par niveau cumulé de médecin", () => {
    expect(getDoctorFormCampBoostPct(3)).toBe(15);
    expect(getDoctorFormCampBoostPct(14)).toBe(50);
    expect(
      getFormCampGainPerDay({ type: "classic", doctorBoostPct: 15 }),
    ).toBe(12);
    expect(
      getFormCampGainPerDay({ type: "premium", doctorBoostPct: 25 }),
    ).toBe(25);
    expect(
      getFormCampTotal({
        type: "premium",
        durationDays: 3,
        doctorBoostPct: 25,
      }),
    ).toEqual({ durationDays: 3, totalFormGain: 75, totalPrice: 18_000 });
  });

  it("améliore et réduit le prix des interventions nutritionnelles avec le niveau", () => {
    expect(
      getNutritionInterventionOutcome({
        code: "recovery_snack",
        nutritionistLevel: 1,
      }),
    ).toEqual({ formGain: 3, price: 475, discountPct: 5, isUnlocked: true });
    expect(
      getNutritionInterventionOutcome({
        code: "tailored_plan",
        nutritionistLevel: 3,
      }),
    ).toEqual({ formGain: 6, price: 1_020, discountPct: 15, isUnlocked: true });
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

  it("classe les coureurs de la forme la plus faible à la plus élevée", () => {
    const riders = [
      { id: "high", firstName: "Zoé", lastName: "Martin", form: 92 },
      { id: "low-b", firstName: "Luc", lastName: "Bernard", form: 38 },
      { id: "medium", firstName: "Inès", lastName: "Moreau", form: 64 },
      { id: "low-a", firstName: "Alix", lastName: "Bernard", form: 38 },
    ];

    expect(orderNutritionRidersByForm(riders).map((rider) => rider.id)).toEqual([
      "low-a",
      "low-b",
      "medium",
      "high",
    ]);
    expect(riders.map((rider) => rider.id)).toEqual([
      "high",
      "low-b",
      "medium",
      "low-a",
    ]);
  });
});

function sequence(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
