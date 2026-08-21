import {
  TRAINER_SPECIALTY_LABELS,
  isTrainerSpecialty,
  normalizeStaffLevel,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";

export const STAFF_TALENT_SLOTS_MAX = 3;
export const STAFF_NATIONALITY_EFFICIENCY_BONUS_PERCENTAGE = 10;

export const STAFF_TALENTS_BY_ROLE = {
  physiotherapist: [
    "physio_race_recovery",
    "physio_training_recovery",
    "physio_injury_prevention",
  ],
  mechanic: [
    "mechanic_incident_time",
    "mechanic_wheel_efficiency",
    "mechanic_frame_efficiency",
    "mechanic_wheel_interchangeability",
  ],
  architect: [
    "architect_construction_time",
    "architect_construction_cost",
    "architect_maintenance_cost",
    "architect_parallel_construction",
  ],
  community_manager: [
    "community_victory_reputation",
    "community_breakaway_reputation",
    "community_daily_reputation",
  ],
  scout: [
    "scout_report_size",
    "scout_youth_talent",
    "scout_youth_ratings",
    "scout_tuition_cost",
  ],
  trainer: [
    "trainer_mountain",
    "trainer_hills",
    "trainer_flat",
    "trainer_sprint",
    "trainer_time_trial",
    "trainer_cobbles",
    "trainer_endurance",
  ],
  race_preparer: ["preparer_duration", "preparer_quality", "preparer_capacity"],
  nutritionist: [
    "nutrition_daily_form",
    "nutrition_supplement_cost",
    "nutrition_supplement_effectiveness",
    "nutrition_supplement_capacity",
  ],
  doctor: [
    "doctor_recovery_time",
    "doctor_care_effectiveness",
    "doctor_care_cost",
    "doctor_injury_form_loss",
  ],
  research_engineer: ["research_time", "research_cost", "research_success"],
} as const satisfies Record<StaffRole, readonly string[]>;

export type StaffTalentCode = (typeof STAFF_TALENTS_BY_ROLE)[StaffRole][number];

export type StaffTalentDefinition = {
  role: StaffRole;
  label: string;
  minimumLevel?: number;
  description: (level: number) => string;
};

const percentage = (level: number, perLevel: number) =>
  normalizeStaffLevel(level) * perLevel;

export const STAFF_TALENT_DEFINITIONS: Record<
  StaffTalentCode,
  StaffTalentDefinition
> = {
  physio_race_recovery: {
    role: "physiotherapist",
    label: "Récupération après course",
    description: () =>
      "+1 point de forme préservé après chaque course du coureur suivi",
  },
  physio_training_recovery: {
    role: "physiotherapist",
    label: "Récupération après entraînement",
    description: () =>
      "+1 point de forme préservé après un entraînement du coureur suivi",
  },
  physio_injury_prevention: {
    role: "physiotherapist",
    label: "Prévention des blessures",
    description: (level) =>
      `−${percentage(level, 3)} % de risque de blessure en cas de chute`,
  },
  mechanic_incident_time: {
    role: "mechanic",
    label: "Intervention express",
    description: (level) =>
      `−${percentage(level, 3)} % de temps perdu supplémentaire lors d’une avarie`,
  },
  mechanic_wheel_efficiency: {
    role: "mechanic",
    label: "Expert roues",
    description: (level) =>
      `+${percentage(level, 4)} % d’efficacité sur les bonus des roues`,
  },
  mechanic_frame_efficiency: {
    role: "mechanic",
    label: "Expert cadres",
    description: (level) =>
      `+${percentage(level, 4)} % d’efficacité sur les bonus des cadres`,
  },
  mechanic_wheel_interchangeability: {
    role: "mechanic",
    label: "Roues interchangeables",
    minimumLevel: 4,
    description: () =>
      "Permet de monter une roue avant à l’arrière ou une roue arrière à l’avant : un coureur peut utiliser deux roues du même type",
  },
  architect_construction_time: {
    role: "architect",
    label: "Chantiers accélérés",
    description: (level) =>
      `−${percentage(level, 2)} % supplémentaire sur les délais de construction`,
  },
  architect_construction_cost: {
    role: "architect",
    label: "Achats optimisés",
    description: (level) =>
      `−${percentage(level, 2)} % supplémentaire sur les coûts de construction`,
  },
  architect_maintenance_cost: {
    role: "architect",
    label: "Maintenance raisonnée",
    description: (level) =>
      `−${percentage(level, 2)} % sur les futurs coûts de maintenance des bâtiments livrés`,
  },
  architect_parallel_construction: {
    role: "architect",
    label: "Double chantier",
    minimumLevel: 3,
    description: () =>
      "Ajoute une ligne de construction : permet de construire deux bâtiments en même temps lorsque cet architecte est affecté à l’un des deux chantiers",
  },
  community_victory_reputation: {
    role: "community_manager",
    label: "Victoire médiatisée",
    description: (level) =>
      `+${percentage(level, 3)} % de réputation supplémentaire sur les victoires`,
  },
  community_breakaway_reputation: {
    role: "community_manager",
    label: "Échappées valorisées",
    description: (level) =>
      `+${percentage(level, 3)} % de réputation supplémentaire sur les échappées`,
  },
  community_daily_reputation: {
    role: "community_manager",
    label: "Présence quotidienne",
    description: (level) =>
      `+${(normalizeStaffLevel(level) * 0.2).toLocaleString("fr-FR", {
        maximumFractionDigits: 1,
      })} point de réputation par jour`,
  },
  scout_report_size: {
    role: "scout",
    label: "Carnet d’adresses",
    description: () => "+1 jeune présenté dans chaque rapport de scouting",
  },
  scout_youth_talent: {
    role: "scout",
    label: "Œil pour le talent",
    description: (level) =>
      `+${(normalizeStaffLevel(level) * 0.15).toLocaleString("fr-FR", {
        maximumFractionDigits: 2,
      })} palier de potentiel dans le calcul des jeunes trouvés`,
  },
  scout_youth_ratings: {
    role: "scout",
    label: "Évaluation précise",
    description: (level) =>
      `+${(normalizeStaffLevel(level) * 0.02).toLocaleString("fr-FR", {
        maximumFractionDigits: 2,
      })} point aux statistiques initiales des jeunes trouvés`,
  },
  scout_tuition_cost: {
    role: "scout",
    label: "Réseau de formation",
    description: (level) =>
      `−${percentage(level, 3)} % sur les frais de scolarité des jeunes trouvés`,
  },
  trainer_mountain: trainerTalent("mountain"),
  trainer_hills: trainerTalent("hills"),
  trainer_flat: trainerTalent("flat"),
  trainer_sprint: trainerTalent("sprint"),
  trainer_time_trial: trainerTalent("time_trial"),
  trainer_cobbles: trainerTalent("cobbles"),
  trainer_endurance: trainerTalent("endurance"),
  preparer_duration: {
    role: "race_preparer",
    label: "Préparation express",
    description: () => "Réduit une reconnaissance de deux jours à un jour",
  },
  preparer_quality: {
    role: "race_preparer",
    label: "Repérage minutieux",
    description: (level) =>
      `+${percentage(level, 3)} % supplémentaire sur le bonus de reconnaissance`,
  },
  preparer_capacity: {
    role: "race_preparer",
    label: "Groupe élargi",
    description: () => "Peut préparer 2 coureurs supplémentaires au même prix",
  },
  nutrition_daily_form: {
    role: "nutritionist",
    label: "Suivi quotidien",
    description: () =>
      "+1 point de forme quotidien supplémentaire pour chaque coureur de l’équipe",
  },
  nutrition_supplement_cost: {
    role: "nutritionist",
    label: "Achats de compléments",
    description: (level) =>
      `−${percentage(level, 2)} % supplémentaire sur le coût des compléments`,
  },
  nutrition_supplement_effectiveness: {
    role: "nutritionist",
    label: "Compléments optimisés",
    description: () =>
      "+1 point de forme supplémentaire sur chaque complément administré",
  },
  nutrition_supplement_capacity: {
    role: "nutritionist",
    label: "Suivi collectif",
    description: () =>
      "Peut administrer 2 compléments supplémentaires par jour",
  },
  doctor_recovery_time: {
    role: "doctor",
    label: "Diagnostic précoce",
    description: (level) =>
      `−${percentage(level, 3)} % supplémentaire sur la convalescence globale`,
  },
  doctor_care_effectiveness: {
    role: "doctor",
    label: "Protocoles renforcés",
    description: (level) =>
      `+${percentage(level, 3)} % d’efficacité sur les protocoles de soin`,
  },
  doctor_care_cost: {
    role: "doctor",
    label: "Réseau médical",
    description: (level) =>
      `−${percentage(level, 3)} % sur le coût des protocoles de soin`,
  },
  doctor_injury_form_loss: {
    role: "doctor",
    label: "Maintien de la condition",
    description: () =>
      "−1 point sur la perte de forme quotidienne pendant une blessure",
  },
  research_time: {
    role: "research_engineer",
    label: "Protocoles accélérés",
    description: (level) =>
      `−${percentage(level, 1)} jour${normalizeStaffLevel(level) > 1 ? "s" : ""} sur chaque recherche R&D`,
  },
  research_cost: {
    role: "research_engineer",
    label: "Optimisation budgétaire",
    description: (level) =>
      `−${percentage(level, 5)} % sur le coût de chaque recherche R&D`,
  },
  research_success: {
    role: "research_engineer",
    label: "Validation expérimentale",
    description: (level) =>
      `+${percentage(level, 3)} points sur la probabilité de réussite R&D`,
  },
};

export function getStaffTalentCodes(
  role: StaffRole,
): readonly StaffTalentCode[] {
  return STAFF_TALENTS_BY_ROLE[role] as readonly StaffTalentCode[];
}

export function isStaffTalentCode(value: string): value is StaffTalentCode {
  return Object.hasOwn(STAFF_TALENT_DEFINITIONS, value);
}

export function isStaffTalentForRole(
  value: string,
  role: StaffRole,
): value is StaffTalentCode {
  return (
    isStaffTalentCode(value) && STAFF_TALENT_DEFINITIONS[value].role === role
  );
}

export function selectInitialStaffTalent({
  role,
  roll,
  trainerSpecialty,
  staffLevel,
}: {
  role: StaffRole;
  roll: number;
  trainerSpecialty?: TrainerSpecialty | null;
  staffLevel?: number;
}): StaffTalentCode {
  const candidates = getStaffTalentCodes(role).filter(
    (code) =>
      (role !== "trainer" ||
        !trainerSpecialty ||
        code !== `trainer_${trainerSpecialty}`) &&
      !(
        normalizeStaffLevel(staffLevel ?? 1) <
        (STAFF_TALENT_DEFINITIONS[code].minimumLevel ?? 1)
      ),
  );
  const normalizedRoll = Number.isFinite(roll) ? Math.floor(roll) : 0;
  return candidates[
    ((normalizedRoll % candidates.length) + candidates.length) %
      candidates.length
  ]!;
}

export function describeStaffTalent(
  code: StaffTalentCode,
  level: number,
): string {
  return STAFF_TALENT_DEFINITIONS[code].description(level);
}

export function getStaffTalentMinimumLevel(code: StaffTalentCode): number {
  return STAFF_TALENT_DEFINITIONS[code].minimumLevel ?? 1;
}

export function getTrainerTalentSpecialty(
  value: string,
): TrainerSpecialty | null {
  if (!isStaffTalentForRole(value, "trainer")) return null;

  const specialty = value.slice("trainer_".length);
  return isTrainerSpecialty(specialty) ? specialty : null;
}

export function getStaffNationalityAffinityDescription(): string {
  return `+${STAFF_NATIONALITY_EFFICIENCY_BONUS_PERCENTAGE} % d’efficacité grâce à l’affinité nationale`;
}

export function getScoutTalentBonuses(
  talentCodes: readonly StaffTalentCode[],
  level: number,
) {
  const safeLevel = normalizeStaffLevel(level);
  const has = (code: StaffTalentCode) => talentCodes.includes(code);

  return {
    reportSizeBonus: has("scout_report_size") ? 1 : 0,
    potentialBonus: has("scout_youth_talent") ? safeLevel * 0.15 : 0,
    initialRatingBonus: has("scout_youth_ratings") ? safeLevel * 0.02 : 0,
    tuitionReductionPercentage: has("scout_tuition_cost") ? safeLevel * 3 : 0,
  };
}

function trainerTalent(specialty: TrainerSpecialty): StaffTalentDefinition {
  return {
    role: "trainer",
    label: `Domaine ${TRAINER_SPECIALTY_LABELS[specialty]}`,
    description: (level) =>
      `+${percentage(level, 4)} % d’efficacité sur les entraînements ${TRAINER_SPECIALTY_LABELS[
        specialty
      ].toLocaleLowerCase("fr")}, cumulable avec la spécialité principale`,
  };
}
