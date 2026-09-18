import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  canDirectorBuildInfrastructureLevel,
  getTeamInfrastructureCodesByStartingCost,
  getTeamInfrastructureLevelDefinition,
  isArchitectSpecialty,
  isTeamInfrastructureCode,
  type ArchitectSpecialty,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";
import { getInfrastructureConstructionOptions } from "@/lib/game/infrastructure-construction";
import { calculateSportingDirectorProgression } from "@/lib/game/sporting-director-progression";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";

type DashboardConstructionArchitect = {
  contractId: string;
  level: number;
  specialty: ArchitectSpecialty;
  costReductionPercentage: number;
  hasParallelConstructionTalent: boolean;
};

type DashboardConstructionProject = {
  code: string;
  architectContractId: string | null;
};

export type DashboardConstructionContext = {
  experiencePoints: number;
  balance: number;
  levels: Partial<Record<TeamInfrastructureCode, number>>;
  activeProjects: DashboardConstructionProject[];
  architects: DashboardConstructionArchitect[];
};

export type DashboardConstructionOpportunity = {
  slotNumber: 1 | 2;
  buildingName: string;
  href: string;
  availableBuildingCount: number;
};

export function parseDashboardConstructionContext(
  value: unknown,
): DashboardConstructionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const balance = Number(payload.balance);
  const experiencePoints = Number(payload.experiencePoints);
  if (!Number.isFinite(balance) || !Number.isFinite(experiencePoints)) {
    return null;
  }

  const rawLevels =
    payload.levels && typeof payload.levels === "object" && !Array.isArray(payload.levels)
      ? (payload.levels as Record<string, unknown>)
      : {};
  const levels: DashboardConstructionContext["levels"] = {};
  for (const [code, level] of Object.entries(rawLevels)) {
    if (isTeamInfrastructureCode(code) && Number.isFinite(Number(level))) {
      levels[code] = Math.max(0, Math.trunc(Number(level)));
    }
  }

  const activeProjects = Array.isArray(payload.activeProjects)
    ? payload.activeProjects.flatMap((value): DashboardConstructionProject[] => {
        if (!value || typeof value !== "object") return [];
        const project = value as Record<string, unknown>;
        return typeof project.code === "string"
          ? [{
              code: project.code,
              architectContractId:
                typeof project.architectContractId === "string"
                  ? project.architectContractId
                  : null,
            }]
          : [];
      })
    : [];
  const architects = Array.isArray(payload.architects)
    ? payload.architects.flatMap((value): DashboardConstructionArchitect[] => {
        if (!value || typeof value !== "object") return [];
        const architect = value as Record<string, unknown>;
        const level = Number(architect.level);
        const reduction = Number(architect.costReductionPercentage);
        if (
          typeof architect.contractId !== "string" ||
          typeof architect.specialty !== "string" ||
          !isArchitectSpecialty(architect.specialty) ||
          !Number.isFinite(level) ||
          !Number.isFinite(reduction)
        ) {
          return [];
        }
        return [{
          contractId: architect.contractId,
          level: Math.max(1, Math.trunc(level)),
          specialty: architect.specialty,
          costReductionPercentage: Math.max(0, Math.min(45, reduction)),
          hasParallelConstructionTalent:
            architect.hasParallelConstructionTalent === true,
        }];
      })
    : [];

  return { experiencePoints, balance, levels, activeProjects, architects };
}

export function getDashboardConstructionOpportunity(
  context: DashboardConstructionContext | null,
): DashboardConstructionOpportunity | null {
  if (!context || context.activeProjects.length >= 2) return null;

  const options = getInfrastructureConstructionOptions({
    architects: context.architects,
    activeProjects: context.activeProjects,
  });
  if (
    options.capacityBlockReason ||
    (!options.canStartWithoutArchitect && options.eligibleArchitects.length === 0)
  ) {
    return null;
  }

  const directorLevel = calculateSportingDirectorProgression(
    context.experiencePoints,
  ).level;
  const candidates = getTeamInfrastructureCodesByStartingCost().flatMap((code) => {
    const nextLevel = getTeamInfrastructureLevelDefinition(
      code,
      (context.levels[code] ?? 0) + 1,
    );
    if (
      !nextLevel ||
      !canDirectorBuildInfrastructureLevel(directorLevel, nextLevel.level) ||
      context.activeProjects.some((project) => project.code === code) ||
      (code === "club_shop" && (context.levels.fan_club_headquarters ?? 0) < 1)
    ) {
      return [];
    }

    const architectCosts = options.eligibleArchitects.map((architect) =>
      calculateConstructionWithArchitect({
        baseCost: nextLevel.cost,
        baseDurationDays: nextLevel.durationDays,
        architectLevel: architect.level,
        architectSpecialty: architect.specialty,
        costReductionPercentage: architect.costReductionPercentage,
      }).cost,
    );
    const lowestCost = Math.min(
      options.canStartWithoutArchitect ? nextLevel.cost : Number.POSITIVE_INFINITY,
      ...architectCosts,
    );
    return lowestCost <= context.balance
      ? [{ code, cost: lowestCost, name: TEAM_INFRASTRUCTURE_DEFINITIONS[code].name }]
      : [];
  });
  candidates.sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name, "fr"));
  const first = candidates[0];
  if (!first) return null;

  return {
    slotNumber: context.activeProjects.length === 0 ? 1 : 2,
    buildingName: first.name,
    href: `/jeu/infrastructures?onglet=batiments#batiment-${first.code}`,
    availableBuildingCount: candidates.length,
  };
}
