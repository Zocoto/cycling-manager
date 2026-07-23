export const INFRASTRUCTURE_UNLOCK_LEVEL = 10;
export const MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE = 90;

export type TeamInfrastructureCode = "recruitment_data_room";

export type ArchitectSpecialty = "economist" | "foreman" | "balanced";

export const ARCHITECT_SPECIALTIES = [
  "economist",
  "foreman",
  "balanced",
] as const satisfies readonly ArchitectSpecialty[];

export const ARCHITECT_SPECIALTY_LABELS: Record<
  ArchitectSpecialty,
  string
> = {
  economist: "Économe",
  foreman: "Chef de chantier",
  balanced: "Polyvalent",
};

export type InfrastructureLevelDefinition = {
  level: number;
  cost: number;
  durationDays: number;
  effect: string;
};

export type TeamInfrastructureDefinition = {
  code: TeamInfrastructureCode;
  name: string;
  domain: string;
  summary: string;
  levels: readonly InfrastructureLevelDefinition[];
};

export const TEAM_INFRASTRUCTURE_DEFINITIONS: Record<
  TeamInfrastructureCode,
  TeamInfrastructureDefinition
> = {
  recruitment_data_room: {
    code: "recruitment_data_room",
    name: "Data Room du recrutement",
    domain: "Scouting · Transferts",
    summary:
      "Réduit progressivement l’incertitude des rapports présentés sur le marché des transferts.",
    levels: [
      {
        level: 1,
        cost: 350_000,
        durationDays: 14,
        effect:
          "3 notes exactes, 8 fourchettes, 2 inconnues et potentiel toujours estimé.",
      },
      {
        level: 2,
        cost: 700_000,
        durationDays: 28,
        effect:
          "5 notes exactes, 8 fourchettes resserrées et plus aucune note inconnue.",
      },
      {
        level: 3,
        cost: 1_200_000,
        durationDays: 42,
        effect:
          "7 notes exactes et 6 fourchettes très resserrées ; potentiel estimé à une demi-étoile près.",
      },
    ],
  },
};

export const INTERNATIONAL_CENTER_LEVELS = [
  {
    level: 1,
    cost: 500_000,
    durationDays: 28,
    bonusPercentage: 10,
  },
  {
    level: 2,
    cost: 750_000,
    durationDays: 35,
    bonusPercentage: 20,
  },
  {
    level: 3,
    cost: 1_000_000,
    durationDays: 42,
    bonusPercentage: 30,
  },
  {
    level: 4,
    cost: 1_350_000,
    durationDays: 49,
    bonusPercentage: 40,
  },
  {
    level: 5,
    cost: 1_800_000,
    durationDays: 56,
    bonusPercentage: 50,
  },
] as const;

export function getTeamInfrastructureLevelDefinition(
  code: TeamInfrastructureCode,
  level: number,
): InfrastructureLevelDefinition | null {
  return (
    TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.find(
      (definition) => definition.level === level,
    ) ?? null
  );
}

export function getInternationalCenterLevelDefinition(level: number) {
  return (
    INTERNATIONAL_CENTER_LEVELS.find(
      (definition) => definition.level === level,
    ) ?? null
  );
}

export function getInternationalCenterBonusPercentage(
  totalQualityStars: number,
): number {
  return Math.min(
    MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE,
    Math.max(0, Math.floor(totalQualityStars)) * 10,
  );
}

export function applyInternationalCenterPotentialBonus({
  potentialSteps,
  totalQualityStars,
  random,
}: {
  potentialSteps: number;
  totalQualityStars: number;
  random: () => number;
}): {
  potentialSteps: number;
  bonusApplied: boolean;
  bonusPercentage: number;
} {
  const safePotential = Math.min(8, Math.max(1, Math.round(potentialSteps)));
  const bonusPercentage =
    getInternationalCenterBonusPercentage(totalQualityStars);
  const bonusApplied =
    safePotential <= 6 && random() < bonusPercentage / 100;

  return {
    potentialSteps: bonusApplied ? safePotential + 2 : safePotential,
    bonusApplied,
    bonusPercentage,
  };
}

export function getScoutingVisibilityForDataRoom(level: number): {
  exactRatingCount: number;
  rangeRatingCount: number;
  minimumRangeSpread: number;
  maximumRangeSpread: number;
  potentialCanBeUnknown: boolean;
  potentialMaximumSpreadSteps: number;
} {
  const safeLevel = Math.min(3, Math.max(0, Math.floor(level)));

  if (safeLevel === 1) {
    return {
      exactRatingCount: 3,
      rangeRatingCount: 8,
      minimumRangeSpread: 2,
      maximumRangeSpread: 4,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 2,
    };
  }

  if (safeLevel === 2) {
    return {
      exactRatingCount: 5,
      rangeRatingCount: 8,
      minimumRangeSpread: 1,
      maximumRangeSpread: 3,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 1,
    };
  }

  if (safeLevel === 3) {
    return {
      exactRatingCount: 7,
      rangeRatingCount: 6,
      minimumRangeSpread: 1,
      maximumRangeSpread: 1,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 1,
    };
  }

  return {
    exactRatingCount: 3,
    rangeRatingCount: 6,
    minimumRangeSpread: 2,
    maximumRangeSpread: 4,
    potentialCanBeUnknown: true,
    potentialMaximumSpreadSteps: 2,
  };
}

export function isTeamInfrastructureCode(
  value: string,
): value is TeamInfrastructureCode {
  return value === "recruitment_data_room";
}

export function isArchitectSpecialty(
  value: string,
): value is ArchitectSpecialty {
  return ARCHITECT_SPECIALTIES.includes(value as ArchitectSpecialty);
}
