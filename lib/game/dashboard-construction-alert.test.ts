import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  getDashboardConstructionOpportunity,
  parseDashboardConstructionContext,
  type DashboardConstructionContext,
} from "@/lib/game/dashboard-construction-alert";
import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  getTeamInfrastructureCodesByStartingCost,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";

const regularArchitect = {
  contractId: "regular",
  level: 3,
  specialty: "balanced" as const,
  costReductionPercentage: 12,
  hasParallelConstructionTalent: false,
};
const parallelArchitect = {
  contractId: "parallel",
  level: 3,
  specialty: "balanced" as const,
  costReductionPercentage: 12,
  hasParallelConstructionTalent: true,
};
const context: DashboardConstructionContext = {
  experiencePoints: 10_000,
  balance: 10_000_000,
  levels: {},
  activeProjects: [],
  architects: [],
};

describe("dashboard construction opportunity", () => {
  it("signals the first free construction line without requiring an architect", () => {
    expect(getDashboardConstructionOpportunity(context)).toEqual(
      expect.objectContaining({
        slotNumber: 1,
        href: expect.stringMatching(
          /^\/jeu\/infrastructures\?onglet=batiments#batiment-/,
        ),
      }),
    );
  });

  it("does not offer an unaffordable or level-locked building", () => {
    expect(
      getDashboardConstructionOpportunity({ ...context, balance: 0 }),
    ).toBeNull();
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        experiencePoints: 0,
      }),
    ).toBeNull();
  });

  it("requires the Double chantier architect for the second line when the first has none", () => {
    const oneProject = [{ code: "training_center", architectContractId: null }];
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        activeProjects: oneProject,
        architects: [regularArchitect],
      }),
    ).toBeNull();
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        activeProjects: oneProject,
        architects: [regularArchitect, parallelArchitect],
      }),
    ).toEqual(expect.objectContaining({ slotNumber: 2 }));
  });

  it("keeps the second line open without another architect when the talented architect runs the first", () => {
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        activeProjects: [{
          code: "training_center",
          architectContractId: parallelArchitect.contractId,
        }],
        architects: [parallelArchitect],
      }),
    ).toEqual(expect.objectContaining({ slotNumber: 2 }));
  });

  it("never suggests a third project", () => {
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        activeProjects: [
          { code: "training_center", architectContractId: "regular" },
          { code: "indoor_track", architectContractId: "parallel" },
        ],
        architects: [regularArchitect, parallelArchitect],
      }),
    ).toBeNull();
  });

  it("respects active building projects and the Fan Club shop prerequisite", () => {
    const levels = maxedLevels();
    levels.training_center = 0;
    expect(
      getDashboardConstructionOpportunity({
        ...context,
        levels,
        activeProjects: [{ code: "training_center", architectContractId: null }],
        architects: [parallelArchitect],
      }),
    ).toBeNull();

    levels.training_center = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center.levels.at(-1)!.level;
    levels.club_shop = 0;
    levels.fan_club_headquarters = 0;
    expect(
      getDashboardConstructionOpportunity({ ...context, levels })?.href,
    ).not.toContain("batiment-club_shop");
  });

  it("counts a building made affordable by the selected available architect", () => {
    const levels = maxedLevels();
    levels.training_center = 0;
    const baseCost = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center.levels[0]!.cost;
    const opportunity = getDashboardConstructionOpportunity({
      ...context,
      balance: Math.round(baseCost * 0.8),
      levels,
      architects: [{
        ...regularArchitect,
        costReductionPercentage: 20,
      }],
    });
    expect(opportunity?.href).toBe(
      "/jeu/infrastructures?onglet=batiments#batiment-training_center",
    );
  });

  it("rejects malformed context and maps only active architect data", () => {
    expect(parseDashboardConstructionContext({ balance: "x" })).toBeNull();
    expect(
      parseDashboardConstructionContext({
        balance: 1_000_000,
        experiencePoints: 10_000,
        levels: { training_center: 1, bogus: 8 },
        activeProjects: [{ code: "training_center", architectContractId: null }],
        architects: [{
          contractId: "parallel",
          level: 3,
          specialty: "balanced",
          costReductionPercentage: 12,
          hasParallelConstructionTalent: true,
        }],
      }),
    ).toEqual(expect.objectContaining({
      levels: { training_center: 1 },
      architects: [expect.objectContaining({ hasParallelConstructionTalent: true })],
    }));
  });

  it("scopes the lightweight SQL context to the signed-in DS and active projects/contracts", () => {
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20260919010000_add_dashboard_construction_opportunity_context.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("project.status = 'active'");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("architect_parallel_construction");
    expect(migration).toContain("get_architect_adjusted_reduction");
  });
});

function maxedLevels(): Partial<Record<TeamInfrastructureCode, number>> {
  return Object.fromEntries(
    getTeamInfrastructureCodesByStartingCost().map((code) => [
      code,
      TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.at(-1)!.level,
    ]),
  ) as Partial<Record<TeamInfrastructureCode, number>>;
}
