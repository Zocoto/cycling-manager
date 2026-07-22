export const RIDER_INJURY_DIAGNOSES = {
  rib_fracture: {
    label: "Fracture des côtes",
    recoveryHours: 72,
    severity: "moderate",
    abandonmentChance: 0.3,
  },
  wrist_fracture: {
    label: "Fracture du poignet",
    recoveryHours: 96,
    severity: "moderate",
    abandonmentChance: 0.7,
  },
  clavicle_fracture: {
    label: "Fracture de la clavicule",
    recoveryHours: 120,
    severity: "serious",
    abandonmentChance: 1,
  },
  fatigue_exhaustion: {
    label: "Blessure de fatigue",
    recoveryHours: 72,
    severity: "minor",
    abandonmentChance: 0,
  },
} as const;

export type RiderInjuryDiagnosisCode = keyof typeof RIDER_INJURY_DIAGNOSES;
type CrashInjuryDiagnosisCode = Exclude<
  RiderInjuryDiagnosisCode,
  "fatigue_exhaustion"
>;

export type RaceMedicalOutcome = {
  diagnosisCode: CrashInjuryDiagnosisCode;
  label: string;
  recoveryHours: number;
  recoveryDays: number;
  severity: "moderate" | "serious";
  causesAbandonment: boolean;
};

export const FORM_CAMP_TYPES = {
  classic: {
    label: "Stage classique",
    formGainPerDay: 5,
    pricePerDay: 2_000,
  },
  premium: {
    label: "Stage premium",
    formGainPerDay: 10,
    pricePerDay: 6_000,
  },
} as const;

export type FormCampType = keyof typeof FORM_CAMP_TYPES;

export const NUTRITION_INTERVENTIONS = {
  recovery_snack: {
    label: "Collation de récupération",
    description: "Un apport ciblé pour relancer rapidement la récupération.",
    baseFormGain: 3,
    basePrice: 1_500,
    minimumNutritionistLevel: 1,
  },
  tailored_plan: {
    label: "Plan nutritionnel personnalisé",
    description: "Une journée alimentaire complète adaptée au profil du coureur.",
    baseFormGain: 5,
    basePrice: 3_500,
    minimumNutritionistLevel: 3,
  },
  elite_recharge: {
    label: "Recharge haute performance",
    description: "Le protocole le plus poussé avant ou après un grand objectif.",
    baseFormGain: 7,
    basePrice: 6_500,
    minimumNutritionistLevel: 5,
  },
} as const;

export type NutritionInterventionCode = keyof typeof NUTRITION_INTERVENTIONS;

export function getNutritionInterventionOutcome({
  code,
  nutritionistLevel,
}: {
  code: NutritionInterventionCode;
  nutritionistLevel: number;
}) {
  const intervention = NUTRITION_INTERVENTIONS[code];
  const level = clamp(Math.trunc(nutritionistLevel), 1, 5);
  const discountPct = level * 5;

  return {
    formGain: intervention.baseFormGain + Math.floor((level - 1) / 2),
    price: Math.round(intervention.basePrice * (1 - discountPct / 100)),
    discountPct,
    isUnlocked: level >= intervention.minimumNutritionistLevel,
  };
}

export function getNutritionistDailyRecoveryBonus({
  nutritionistLevel,
  dayNumber,
}: {
  nutritionistLevel: number;
  dayNumber: number;
}) {
  const level = clamp(Math.trunc(nutritionistLevel), 0, 5);
  const day = Math.max(1, Math.trunc(dayNumber));

  return Math.floor((day * level) / 5) - Math.floor(((day - 1) * level) / 5);
}

export const MEDICAL_PROTOCOLS = {
  accelerated_recovery: {
    label: "Récupération accélérée",
    description: "Réduit la convalescence de 10 %, sans protéger la forme.",
    durationReductionPct: 10,
    formLossPerDay: 10,
    price: 5_000,
  },
  form_preservation: {
    label: "Préservation de la forme",
    description: "Ramène la perte quotidienne de forme de 10 à 7 points.",
    durationReductionPct: 0,
    formLossPerDay: 7,
    price: 6_000,
  },
  complete_care: {
    label: "Protocole complet",
    description: "Réduit la convalescence de 5 % et la perte à 8 points par jour.",
    durationReductionPct: 5,
    formLossPerDay: 8,
    price: 9_000,
  },
} as const;

export type MedicalProtocolCode = keyof typeof MEDICAL_PROTOCOLS;

const BASE_CRASH_INJURY_CHANCE = 0.2;

export function resolveCrashMedicalOutcome({
  random,
  injuryRiskReductionPct = 0,
}: {
  random: () => number;
  injuryRiskReductionPct?: number;
}): RaceMedicalOutcome | null {
  const protection = clamp(injuryRiskReductionPct, 0, 45) / 100;
  const injuryChance = BASE_CRASH_INJURY_CHANCE * (1 - protection);

  if (random() >= injuryChance) return null;

  const diagnosisRoll = random();
  const diagnosisCode: CrashInjuryDiagnosisCode =
    diagnosisRoll < 0.5
      ? "rib_fracture"
      : diagnosisRoll < 0.8
        ? "wrist_fracture"
        : "clavicle_fracture";
  const diagnosis = RIDER_INJURY_DIAGNOSES[diagnosisCode];

  return {
    diagnosisCode,
    label: diagnosis.label,
    recoveryHours: diagnosis.recoveryHours,
    recoveryDays: diagnosis.recoveryHours / 24,
    severity: diagnosis.severity,
    causesAbandonment: random() < diagnosis.abandonmentChance,
  };
}

export function resolveRiderFormChange({
  formBefore,
  formDelta,
}: {
  formBefore: number;
  formDelta: number;
}) {
  const attemptedForm = Math.trunc(formBefore) + Math.trunc(formDelta);

  return {
    form: clamp(attemptedForm, 0, 100),
    causesFatigueInjury: attemptedForm < 0,
    fatigueInjuryHours: attemptedForm < 0 ? 72 : 0,
  };
}

export function getProtocolRecoveryReductionHours({
  recoveryHours,
  durationReductionPct,
}: {
  recoveryHours: number;
  durationReductionPct: number;
}) {
  return Math.ceil(
    Math.max(0, recoveryHours) *
      clamp(durationReductionPct, 0, 100) /
      100
  );
}

export function getFormCampTotal({
  type,
  durationDays,
}: {
  type: FormCampType;
  durationDays: number;
}) {
  const duration = clamp(Math.trunc(durationDays), 1, 3);
  const camp = FORM_CAMP_TYPES[type];

  return {
    durationDays: duration,
    totalFormGain: camp.formGainPerDay * duration,
    totalPrice: camp.pricePerDay * duration,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
