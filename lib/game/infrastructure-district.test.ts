import { describe, expect, it } from "vitest";

import {
  buildInfrastructureDistrict,
  getCampusSponsor,
} from "@/lib/game/infrastructure-district";
import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  getTeamInfrastructureCodesByStartingCost,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";
import type { InfrastructureProject, TeamInfrastructureOverview } from "@/services/team-infrastructures";
import type { Sponsor } from "@/types/sponsor";

function levels(
  overrides: Partial<Record<TeamInfrastructureCode, number>> = {},
): TeamInfrastructureOverview["infrastructureLevels"] {
  return {
    ...Object.fromEntries(Object.keys(TEAM_INFRASTRUCTURE_DEFINITIONS).map((code) => [code, 0])),
    ...overrides,
  } as TeamInfrastructureOverview["infrastructureLevels"];
}

function project(
  code: InfrastructureProject["code"],
  overrides: Partial<InfrastructureProject> = {},
): InfrastructureProject {
  return {
    id: `project-${code}`,
    code,
    name: "Chantier de l’équipe",
    countryId: null,
    countryName: null,
    targetLevel: 1,
    architectContractId: null,
    finalCost: 200_000,
    finalDurationDays: 9,
    costReductionPercentage: 0,
    durationReductionPercentage: 0,
    efficiencyBonusPercentage: 0,
    architectSpecialtyLabel: null,
    startedDayNumber: 23,
    remainingDays: 7,
    completionGameYear: 6,
    completionDayNumber: 2,
    status: "active",
    completedAt: null,
    ...overrides,
  };
}

describe("production infrastructure district", () => {
  it("provides one plot for all sixteen active canonical buildings in catalogue order", () => {
    const district = buildInfrastructureDistrict({ infrastructureLevels: levels(), activeProjects: [] });
    const codes = district.map((building) => building.code);

    expect(codes).toEqual(getTeamInfrastructureCodesByStartingCost());
    expect(codes).toHaveLength(16);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["cobbles_center", "hills_circuit", "mountain_base"]));
    expect(codes).not.toContain("tactical_center");
    for (const building of district) {
      expect(Number.isFinite(building.x), building.code).toBe(true);
      expect(Number.isFinite(building.y), building.code).toBe(true);
      expect(building.shortName, building.code).not.toBe("");
      expect(building.level, building.code).toBe(0);
      expect(building.construction, building.code).toBeUndefined();
    }
  });

  it("uses actual owned levels and clamps them to each building’s supported range", () => {
    const district = buildInfrastructureDistrict({
      infrastructureLevels: levels({
        recruitment_data_room: 99,
        training_center: 2.9,
        cryotherapy_center: -3,
        mountain_base: 4,
        tactical_center: 5,
      }),
      activeProjects: [],
    });
    const byCode = new Map(district.map((building) => [building.code, building]));

    expect(byCode.get("recruitment_data_room")?.level).toBe(3);
    expect(byCode.get("training_center")?.level).toBe(2);
    expect(byCode.get("cryotherapy_center")?.level).toBe(0);
    expect(byCode.get("mountain_base")?.level).toBe(4);
    expect(byCode.has("tactical_center")).toBe(false);
  });

  it("maps new construction and upgrades from real active projects without inventing elapsed wall time", () => {
    const district = buildInfrastructureDistrict({
      infrastructureLevels: levels({ staff_academy: 2 }),
      activeProjects: [
        project("staff_academy", { status: "completed", targetLevel: 2 }),
        project("cryotherapy_center", { remainingDays: 1, completionGameYear: 5, completionDayNumber: 28 }),
        project("staff_academy", { targetLevel: 3, remainingDays: 7, completionGameYear: 6, completionDayNumber: 6 }),
      ],
    });
    const cryotherapy = district.find((building) => building.code === "cryotherapy_center");
    const academy = district.find((building) => building.code === "staff_academy");

    expect(cryotherapy?.level).toBe(0);
    expect(cryotherapy?.construction).toEqual({
      targetLevel: 1,
      remainingDays: 1,
      completionGameYear: 5,
      completionDayNumber: 28,
    });
    expect(academy?.level).toBe(2);
    expect(academy?.construction).toEqual({
      targetLevel: 3,
      remainingDays: 7,
      completionGameYear: 6,
      completionDayNumber: 6,
    });
  });

  it("keeps overdue active work visible until settlement while never displaying negative days", () => {
    const district = buildInfrastructureDistrict({
      infrastructureLevels: levels({ training_center: 1 }),
      activeProjects: [project("training_center", { targetLevel: 2, remainingDays: -1 })],
    });
    const training = district.find((building) => building.code === "training_center");

    expect(training?.level).toBe(1);
    expect(training?.construction?.targetLevel).toBe(2);
    expect(training?.construction?.remainingDays).toBe(0);
  });

  it("ignores completed, cancelled, international and retired projects on the team plots", () => {
    const district = buildInfrastructureDistrict({
      infrastructureLevels: levels({ training_center: 2 }),
      activeProjects: [
        project("training_center", { status: "completed", targetLevel: 2 }),
        project("mountain_base", { status: "cancelled" }),
        project("international_youth_center", { countryId: "country-fr", countryName: "France" }),
        project("tactical_center"),
      ],
    });

    expect(district).toHaveLength(16);
    expect(district.every((building) => building.construction === undefined)).toBe(true);
    expect(district.find((building) => building.code === "training_center")?.level).toBe(2);
  });
});

describe("team sponsor identity for the district", () => {
  it("passes the actual sponsor’s visual identity as a small independent payload", () => {
    const sponsor: Sponsor = {
      id: "actual-team-sponsor",
      name: "Le partenaire de cette équipe",
      shortName: "Partenaire",
      logoPath: "/images/sponsors/actual-team-sponsor.webp",
      colors: {
        primary: "#16392e", secondary: "#b7a471", accent: "#99c7af",
        background: "#fffdf4", text: "#123329",
      },
      countryCode: "FR",
      sector: "Transport",
      description: "Catalogue complet non nécessaire au rendu",
      prestige: 3,
      minimumReputation: 200,
      budgetRange: { min: 100_000, max: 500_000 },
      contractDurationRange: { min: 1, max: 3 },
      jerseys: [{ id: "jersey-1", name: "Maillot", style: "classic", imagePath: "/maillot.webp" }],
    };
    const visual = getCampusSponsor(sponsor);

    expect(visual).toEqual({
      id: sponsor.id,
      name: sponsor.name,
      shortName: sponsor.shortName,
      logoPath: sponsor.logoPath,
      colors: sponsor.colors,
    });
    expect(visual).not.toBe(sponsor);
    expect(visual?.colors).not.toBe(sponsor.colors);
    expect(visual).not.toHaveProperty("jerseys");
    expect(visual).not.toHaveProperty("budgetRange");
  });

  it("retains a neutral district when no sponsor is assigned", () => {
    expect(getCampusSponsor(null)).toBeNull();
    expect(getCampusSponsor(undefined)).toBeNull();
  });
});
