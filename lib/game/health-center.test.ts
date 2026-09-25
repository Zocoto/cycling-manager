import { describe, expect, it } from "vitest";

import {
  RIDER_INJURY_DIAGNOSES,
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
      resolveCrashMedicalOutcome({ random: sequence(0.199, 0.5, 0.9) })
        ?.diagnosisCode
    ).toBe("rib_fracture");
  });

  it("répartit toutes les blessures, des abrasions aux fractures graves", () => {
    const weightedDiagnoses = [
      [0.13, "road_rash"],
      [0.14, "hip_contusion"],
      [0.28, "shoulder_sprain"],
      [0.41, "rib_fracture"],
      [0.54, "concussion"],
      [0.66, "wrist_fracture"],
      [0.78, "clavicle_fracture"],
      [0.89, "pelvis_fracture"],
    ] as const;

    for (const [roll, code] of weightedDiagnoses) {
      expect(
        resolveCrashMedicalOutcome({ random: sequence(0, roll, 0.99) })
          ?.diagnosisCode,
      ).toBe(code);
    }
  });

  it("étale régulièrement les durées et les chances de chaque diagnostic", () => {
    const days = Object.entries(RIDER_INJURY_DIAGNOSES)
      .filter(([code]) => code !== "fatigue_exhaustion")
      .map(([, diagnosis]) => diagnosis.recoveryHours / 24)
      .sort((left, right) => left - right);
    expect(days).toEqual([1, 2, 3, 4, 6, 7, 8, 10]);

    const counts = new Map<string, number>();
    for (let index = 0; index < 1_000; index += 1) {
      const outcome = resolveCrashMedicalOutcome({
        random: sequence(0, index / 1_000, 0.99),
      });
      const code = outcome!.diagnosisCode;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    expect(counts.size).toBe(8);
    expect(Math.min(...counts.values())).toBeGreaterThanOrEqual(109);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(141);
  });

  it("propose des convalescences de 1 à 10 jours et le bon type médical", () => {
    expect(resolveCrashMedicalOutcome({ random: sequence(0, 0.1, 0.99) }))
      .toMatchObject({
        diagnosisCode: "road_rash",
        type: "abrasions",
        severity: "minor",
        recoveryHours: 24,
        recoveryDays: 1,
        causesAbandonment: false,
      });
    expect(resolveCrashMedicalOutcome({ random: sequence(0, 0.99, 0.99) }))
      .toMatchObject({
        diagnosisCode: "pelvis_fracture",
        type: "fracture",
        severity: "serious",
        recoveryHours: 240,
        recoveryDays: 10,
        causesAbandonment: true,
      });
    expect(
      Object.values(RIDER_INJURY_DIAGNOSES).every(
        (diagnosis) => diagnosis.recoveryHours <= 240,
      ),
    ).toBe(true);
    expect(RIDER_INJURY_DIAGNOSES.fatigue_exhaustion.recoveryHours).toBe(72);
  });

  it("rend les diagnostics graves éliminatoires et les lésions légères non", () => {
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.85, 0.99) })
        ?.causesAbandonment
    ).toBe(true);
    expect(
      resolveCrashMedicalOutcome({ random: sequence(0, 0.1, 0.99) })
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

  it("réduit le risque d’abandon sur une blessure modérée", () => {
    expect(
      resolveCrashMedicalOutcome({
        random: sequence(0, 0.5, 0.54),
      })?.causesAbandonment,
    ).toBe(true);
    expect(
      resolveCrashMedicalOutcome({
        random: sequence(0, 0.5, 0.54),
        moderateInjuryAbandonmentRiskReductionPct: 8,
      })?.causesAbandonment,
    ).toBe(false);
  });

  it("ne réduit pas l’abandon obligatoire d’une blessure grave", () => {
    expect(
      resolveCrashMedicalOutcome({
        random: sequence(0, 0.85, 0.99),
        moderateInjuryAbandonmentRiskReductionPct: 50,
      })?.causesAbandonment,
    ).toBe(true);
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

  it("affiche le prix et l'efficacité réellement calculés par le serveur", () => {
    expect(
      getNutritionInterventionOutcome({
        code: "recovery_snack",
        nutritionistLevel: 3,
        additionalFormBonus: 1,
        effectivePrice: 398.75,
      }),
    ).toEqual({
      formGain: 5,
      price: 398.75,
      discountPct: 20.3,
      isUnlocked: true,
    });
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
