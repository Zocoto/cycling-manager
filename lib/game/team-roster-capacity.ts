export const BASE_TEAM_ROSTER_SIZE = 35;
export const TEAM_ROSTER_SLOTS_PER_BUILDING_LEVEL = 5;
export const MAX_TEAM_ROSTER_BUILDING_LEVEL = 5;

/**
 * Kept as a compatibility default for call sites that do not yet have a team
 * context. Recruitment and promotion flows must use the calculated limit.
 */
export const MAX_TEAM_ROSTER_SIZE = BASE_TEAM_ROSTER_SIZE;

export type RosterManagementSpecialization =
  | "retention_cell"
  | "rotation_management"
  | "youth_pathway"
  | null;

export function getTeamRosterBaseLimit(buildingLevel: number): number {
  const safeLevel = Number.isFinite(buildingLevel)
    ? Math.min(
        MAX_TEAM_ROSTER_BUILDING_LEVEL,
        Math.max(0, Math.floor(buildingLevel)),
      )
    : 0;
  return (
    BASE_TEAM_ROSTER_SIZE + safeLevel * TEAM_ROSTER_SLOTS_PER_BUILDING_LEVEL
  );
}

export function getTeamRosterYouthReserveSlots({
  buildingLevel,
  specialization,
}: {
  buildingLevel: number;
  specialization: RosterManagementSpecialization;
}): number {
  if (specialization !== "youth_pathway" || buildingLevel < 3) return 0;
  if (buildingLevel === 3) return 3;
  if (buildingLevel === 4) return 4;
  return 5;
}

export function getTeamRosterTotalLimit({
  buildingLevel,
  specialization,
}: {
  buildingLevel: number;
  specialization: RosterManagementSpecialization;
}): number {
  return (
    getTeamRosterBaseLimit(buildingLevel) +
    getTeamRosterYouthReserveSlots({ buildingLevel, specialization })
  );
}

export function getRosterManagementRenewalDiscountPercent({
  buildingLevel,
  specialization,
}: {
  buildingLevel: number;
  specialization: RosterManagementSpecialization;
}): number {
  if (specialization !== "retention_cell" || buildingLevel < 3) return 0;
  if (buildingLevel === 3) return 3;
  if (buildingLevel === 4) return 4;
  return 5;
}

export function getRosterManagementRotationCapacity({
  buildingLevel,
  specialization,
}: {
  buildingLevel: number;
  specialization: RosterManagementSpecialization;
}): number {
  if (specialization !== "rotation_management" || buildingLevel < 3) return 0;
  if (buildingLevel === 3) return 3;
  if (buildingLevel === 4) return 4;
  return 5;
}

export function isTeamRosterAtCapacity(
  riderCount: number,
  rosterLimit = BASE_TEAM_ROSTER_SIZE,
): boolean {
  return (
    Number.isFinite(riderCount) &&
    Number.isFinite(rosterLimit) &&
    riderCount >= rosterLimit
  );
}
