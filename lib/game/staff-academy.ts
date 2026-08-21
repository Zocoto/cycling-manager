export const STAFF_ACADEMY_UNLOCK_DIRECTOR_LEVEL = 10;
export const STAFF_ACADEMY_MAX_LEVEL = 5;
export const STAFF_ACADEMY_MAX_TALENT_LINES = 3;

export type StaffAcademyImprovementType = "level" | "talent";

export const STAFF_ACADEMY_LEVELS = [
  {
    level: 1,
    cost: 1_500_000,
    durationDays: 42,
    capacity: 1,
  },
  {
    level: 2,
    cost: 900_000,
    durationDays: 49,
    capacity: 2,
  },
  {
    level: 3,
    cost: 1_050_000,
    durationDays: 56,
    capacity: 3,
  },
  {
    level: 4,
    cost: 1_200_000,
    durationDays: 70,
    capacity: 4,
  },
  {
    level: 5,
    cost: 1_350_000,
    durationDays: 84,
    capacity: 5,
  },
] as const;

export function getStaffAcademyLevelDefinition(level: number) {
  return (
    STAFF_ACADEMY_LEVELS.find(
      (definition) => definition.level === Math.floor(level),
    ) ?? null
  );
}

export function getStaffAcademyCapacity(level: number): number {
  return getStaffAcademyLevelDefinition(level)?.capacity ?? 0;
}

export function calculateStaffAcademyTraining({
  improvementType,
  staffLevel,
  talentCount,
}: {
  improvementType: StaffAcademyImprovementType;
  staffLevel: number;
  talentCount: number;
}) {
  const safeLevel = Math.min(5, Math.max(1, Math.floor(staffLevel)));
  const safeTalentCount = Math.min(
    STAFF_ACADEMY_MAX_TALENT_LINES,
    Math.max(0, Math.floor(talentCount)),
  );

  if (improvementType === "level") {
    return {
      cost: roundToNearest(
        200_000 + safeLevel * 200_000 + safeTalentCount * 125_000,
        25_000,
      ),
      durationDays: Math.min(
        20,
        5 + (safeLevel - 1) * 3 + Math.max(0, safeTalentCount - 1) * 2,
      ),
    };
  }

  return {
    cost: roundToNearest(
      250_000 +
        safeLevel * 150_000 +
        (safeTalentCount + 1) * 250_000,
      25_000,
    ),
    durationDays: Math.min(
      20,
      6 + (safeLevel - 1) * 2 + safeTalentCount * 3,
    ),
  };
}

export function isStaffAcademyImprovementType(
  value: string,
): value is StaffAcademyImprovementType {
  return value === "level" || value === "talent";
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}
