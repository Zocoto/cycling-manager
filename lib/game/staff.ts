export const STAFF_ROLES = [
  "trainer",
  "scout",
  "doctor",
  "mechanic",
  "nutritionist",
  "physiotherapist",
  "architect",
  "community_manager",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const TRAINER_SPECIALTIES = [
  "mountain",
  "hills",
  "flat",
  "sprint",
  "time_trial",
  "cobbles",
  "endurance",
] as const;

export type TrainerSpecialty = (typeof TRAINER_SPECIALTIES)[number];

export type StaffRoleDefinition = {
  label: string;
  pluralLabel: string;
  shortDescription: string;
  salaryBase: number;
  accent: string;
};

export const STAFF_ROLE_DEFINITIONS: Record<StaffRole, StaffRoleDefinition> = {
  trainer: {
    label: "Entraîneur",
    pluralLabel: "Entraîneurs",
    shortDescription: "Accélère la progression dans sa spécialité.",
    salaryBase: 18_000,
    accent: "#E2A63B",
  },
  scout: {
    label: "Scout",
    pluralLabel: "Scouts",
    shortDescription: "Détecte les talents dans sa zone de prédilection.",
    salaryBase: 15_000,
    accent: "#4E8FB8",
  },
  doctor: {
    label: "Médecin",
    pluralLabel: "Médecins",
    shortDescription: "Réduit le temps de récupération après une blessure.",
    salaryBase: 13_000,
    accent: "#D6655A",
  },
  mechanic: {
    label: "Mécanicien",
    pluralLabel: "Mécaniciens",
    shortDescription: "Limite le temps perdu lors d’une avarie en course.",
    salaryBase: 11_000,
    accent: "#71827C",
  },
  nutritionist: {
    label: "Nutritionniste",
    pluralLabel: "Nutritionnistes",
    shortDescription: "Optimise la récupération et le coût des compléments.",
    salaryBase: 10_000,
    accent: "#78A94E",
  },
  physiotherapist: {
    label: "Kiné",
    pluralLabel: "Kinés",
    shortDescription: "Réduit le malus de forme subi après une course.",
    salaryBase: 9_500,
    accent: "#8B6FB6",
  },
  architect: {
    label: "Architecte",
    pluralLabel: "Architectes",
    shortDescription: "Raccourcit les délais de construction des infrastructures.",
    salaryBase: 9_000,
    accent: "#B27B4A",
  },
  community_manager: {
    label: "Community manager",
    pluralLabel: "Community managers",
    shortDescription: "Amplifie tous les gains de réputation de l’équipe.",
    salaryBase: 8_000,
    accent: "#3FA58B",
  },
};

export const TRAINER_SPECIALTY_LABELS: Record<TrainerSpecialty, string> = {
  mountain: "Montagne",
  hills: "Vallons",
  flat: "Plaine",
  sprint: "Sprint",
  time_trial: "Chrono & prologue",
  cobbles: "Pavés",
  endurance: "Endurance & récupération",
};

export const STAFF_DAILY_ROLE_DISTRIBUTION: readonly StaffRole[] = [
  "trainer",
  "trainer",
  "trainer",
  "trainer",
  "trainer",
  "scout",
  "scout",
  "scout",
  "scout",
  "doctor",
  "doctor",
  "doctor",
  "mechanic",
  "mechanic",
  "mechanic",
  "community_manager",
  "community_manager",
  "community_manager",
  "nutritionist",
  "nutritionist",
  "nutritionist",
  "physiotherapist",
  "physiotherapist",
  "architect",
  "architect",
];

export const STAFF_DAILY_LEVEL_DISTRIBUTION: readonly number[] = [
  1, 1, 1, 1, 1, 1, 1, 1,
  2, 2, 2, 2, 2, 2, 2,
  3, 3, 3, 3, 3,
  4, 4, 4,
  5, 5,
];

const STAFF_LEVEL_SALARY_MULTIPLIERS = [1, 1.35, 1.75, 2.25, 3] as const;

export function normalizeStaffLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(5, Math.max(1, Math.floor(level)));
}

export function calculateStaffSalary(role: StaffRole, level: number): number {
  const safeLevel = normalizeStaffLevel(level);
  const rawSalary =
    STAFF_ROLE_DEFINITIONS[role].salaryBase *
    STAFF_LEVEL_SALARY_MULTIPLIERS[safeLevel - 1];

  return Math.round(rawSalary / 500) * 500;
}

export function calculateStaffSigningFee(role: StaffRole, level: number): number {
  const safeLevel = normalizeStaffLevel(level);
  const salary = calculateStaffSalary(role, safeLevel);
  const feeRate = 0.1 + safeLevel * 0.02;

  return Math.max(1_000, Math.round((salary * feeRate) / 500) * 500);
}

export function calculateStaffWeeklySalary(salaryPerSeason: number): number {
  return Math.round(Math.max(0, salaryPerSeason) / 4);
}

export function calculateDueStaffSalary(
  salaryPerSeason: number,
  currentDayNumber: number,
): number {
  const salary = Math.max(0, salaryPerSeason);
  const dueInstallments = Math.min(
    4,
    Math.max(0, Math.floor(Math.max(1, currentDayNumber) / 7)),
  );
  const regularInstallment = Math.round((salary / 4) * 100) / 100;

  return dueInstallments < 4
    ? regularInstallment * dueInstallments
    : salary;
}

export function getStaffCapacityForDirectorLevel(level: number): number {
  const safeLevel = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  const thresholds = [1, 1, 2, 3, 5, 7, 10, 13, 17, 21, 25];

  if (safeLevel < thresholds.length) {
    return thresholds[safeLevel];
  }

  return Math.min(45, thresholds.at(-1)! + (safeLevel - 10) * 4);
}

export function getPhysiotherapistRiderCapacity(level: number): number {
  return [2, 4, 6, 9, 12][normalizeStaffLevel(level) - 1];
}

export function getNutritionistDailyCapacity(level: number): number {
  return [2, 3, 4, 5, 6][normalizeStaffLevel(level) - 1];
}

export function getStaffEffectPercentage(role: StaffRole, level: number): number {
  const safeLevel = normalizeStaffLevel(level);

  switch (role) {
    case "trainer":
      return safeLevel * 4;
    case "scout":
      return safeLevel * 5;
    case "doctor":
      return safeLevel * 6;
    case "mechanic":
      return safeLevel * 8;
    case "community_manager":
      return safeLevel * 2;
    case "nutritionist":
      return safeLevel * 5;
    case "architect":
      return safeLevel * 5;
    case "physiotherapist":
      return safeLevel;
  }
}

export function describeStaffEffect({
  role,
  level,
  trainerSpecialty,
  countryName,
}: {
  role: StaffRole;
  level: number;
  trainerSpecialty?: TrainerSpecialty | null;
  countryName?: string | null;
}): string[] {
  const safeLevel = normalizeStaffLevel(level);
  const percentage = getStaffEffectPercentage(role, safeLevel);

  switch (role) {
    case "trainer":
      return [
        `+${percentage} % d’efficacité sur les entraînements ${
          trainerSpecialty
            ? TRAINER_SPECIALTY_LABELS[trainerSpecialty].toLocaleLowerCase("fr")
            : "de sa spécialité"
        }`,
      ];
    case "scout":
      return [
        `+${percentage} % de précision dans ses rapports${
          countryName ? ` en ${countryName}` : " dans sa zone nationale"
        }`,
      ];
    case "doctor":
      return [`−${percentage} % de temps de récupération après une blessure`];
    case "mechanic":
      return [`−${percentage} % de temps perdu lors d’une avarie technique`];
    case "community_manager":
      return [`+${percentage} % sur tous les gains de réputation`];
    case "nutritionist":
      return [
        `−${percentage} % sur le coût des compléments alimentaires`,
        `+${safeLevel / 5} point de reprise de forme quotidienne`,
      ];
    case "physiotherapist":
      return [
        `−${safeLevel} point${safeLevel > 1 ? "s" : ""} sur le malus de forme après une course`,
      ];
    case "architect":
      return [`−${percentage} % sur les délais de construction`];
  }
}

export function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole);
}

export function isTrainerSpecialty(value: string): value is TrainerSpecialty {
  return TRAINER_SPECIALTIES.includes(value as TrainerSpecialty);
}
