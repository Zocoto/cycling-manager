import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTERNATIONAL_CENTER_LEVELS,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  applyInfrastructureEfficiencyBonus,
  applyInternationalCenterPotentialBonus,
  canDirectorBuildInfrastructureLevel,
  getRequiredDirectorLevelForInfrastructureLevel,
  getStaffNaturalizationSeasonLimit,
  getTeamInfrastructureCodesByStartingCost,
  getInternationalCenterBonusPercentage,
  getInternationalCenterNetworkEffects,
  isTeamInfrastructureCode,
  getScoutingVisibilityForDataRoom,
} from "@/lib/game/infrastructure";

describe("international cycling schools", () => {
  it("adds half a potential star when the shared country roll succeeds", () => {
    expect(
      applyInternationalCenterPotentialBonus({
        potentialSteps: 5,
        totalQualityStars: 3,
        random: () => 0.02,
      }),
    ).toEqual({
      potentialSteps: 6,
      bonusApplied: true,
      bonusPercentage: 3,
    });
  });

  it("never exceeds four stars", () => {
    expect(getInternationalCenterBonusPercentage(14)).toBe(10);
    expect(
      applyInternationalCenterPotentialBonus({
        potentialSteps: 8,
        totalQualityStars: 14,
        random: () => 0,
      }),
    ).toEqual({
      potentialSteps: 8,
      bonusApplied: false,
      bonusPercentage: 10,
    });
  });

  it("cumule toutes les écoles avec des rendements décroissants", () => {
    const oneSchool = getInternationalCenterNetworkEffects(5);
    const sixSchools = getInternationalCenterNetworkEffects(30);
    const manySchools = getInternationalCenterNetworkEffects(100);

    expect(oneSchool).toMatchObject({
      candidateCountBonus: 1,
      potentialBonusSteps: 1,
      potentialBonusPercentage: 4,
      specialAbilityBonusPercentage: 0.4,
    });
    expect(sixSchools).toMatchObject({
      candidateCountBonus: 3,
      potentialBonusPercentage: 16,
      specialAbilityBonusPercentage: 1.6,
    });
    expect(manySchools.effectiveQualityStars).toBe(100);
    expect(manySchools.potentialBonusPercentage).toBeLessThanOrEqual(20);
    expect(
      manySchools.networkStrengthPercentage -
        sixSchools.networkStrengthPercentage,
    ).toBeLessThan(
      sixSchools.networkStrengthPercentage -
        oneSchool.networkStrengthPercentage,
    );
  });
});

describe("recruitment Data Room", () => {
  it("reste accessible au premier niveau puis renchérit les améliorations", () => {
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.recruitment_data_room.levels.map(
        (level) => level.cost,
      ),
    ).toEqual([200_000, 350_000, 550_000]);
  });

  it("progressively replaces unknown ratings with precise information", () => {
    expect(getScoutingVisibilityForDataRoom(0)).toMatchObject({
      exactRatingCount: 3,
      rangeRatingCount: 6,
      potentialCanBeUnknown: true,
    });
    expect(getScoutingVisibilityForDataRoom(2)).toMatchObject({
      exactRatingCount: 5,
      rangeRatingCount: 8,
      potentialCanBeUnknown: false,
    });
    expect(getScoutingVisibilityForDataRoom(3)).toMatchObject({
      exactRatingCount: 7,
      rangeRatingCount: 6,
      maximumRangeSpread: 1,
    });
  });
});

describe("team infrastructure buildings", () => {
  it("classe les bâtiments du prix d’entrée le plus bas au plus élevé", () => {
    expect(getTeamInfrastructureCodesByStartingCost()).toEqual([
      "weather_center",
      "training_center",
      "club_shop",
      "cryotherapy_center",
      "indoor_track",
      "recruitment_data_room",
      "fan_club_headquarters",
      "wind_tunnel",
      "roster_management_center",
      "media_center",
      "international_welcome_center",
      "research_lab",
      "staff_academy",
    ]);
    expect(getTeamInfrastructureCodesByStartingCost()).not.toContain(
      "tactical_center",
    );
  });

  it("associe chaque bâtiment actif à une illustration WebP livrée", () => {
    for (const definition of Object.values(TEAM_INFRASTRUCTURE_DEFINITIONS)) {
      expect(definition.illustration.src).toMatch(
        /^\/images\/infrastructure\/.+\.webp$/,
      );
      expect(definition.illustration.alt.length).toBeGreaterThan(20);
      expect(
        existsSync(join(process.cwd(), "public", definition.illustration.src)),
      ).toBe(true);
    }
  });

  it("réserve les niveaux avancés du centre d'entraînement aux équipes établies", () => {
    const levels = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center.levels;

    expect(levels.map((level) => level.cost)).toEqual([
      100_000, 250_000, 500_000, 900_000, 1_500_000,
    ]);
    expect(levels.at(-1)?.effect).toContain("+10 %");
  });

  it("préserve une entrée abordable pour la météo et la cryothérapie", () => {
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.weather_center.levels.map(
        (level) => level.cost,
      ),
    ).toEqual([50_000, 90_000, 150_000, 230_000, 350_000]);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.cryotherapy_center.levels.map(
        (level) => level.cost,
      ),
    ).toEqual([150_000, 275_000, 450_000, 700_000, 1_000_000]);
  });

  it("exige 10 niveaux de manager par niveau de bâtiment, plafonnés à 50", () => {
    expect(getRequiredDirectorLevelForInfrastructureLevel(1)).toBe(10);
    expect(getRequiredDirectorLevelForInfrastructureLevel(5)).toBe(50);
    expect(getRequiredDirectorLevelForInfrastructureLevel(7)).toBe(50);
    expect(canDirectorBuildInfrastructureLevel(29, 3)).toBe(false);
    expect(canDirectorBuildInfrastructureLevel(30, 3)).toBe(true);
  });

  it("accorde une naturalisation de staff par niveau du Centre d’accueil", () => {
    expect(getStaffNaturalizationSeasonLimit(0)).toBe(0);
    expect(getStaffNaturalizationSeasonLimit(1)).toBe(1);
    expect(getStaffNaturalizationSeasonLimit(5)).toBe(5);
    expect(getStaffNaturalizationSeasonLimit(8)).toBe(5);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.international_welcome_center.levels[4]
        ?.effect,
    ).toContain("5 membres du staff naturalisables par saison");
  });

  it("enregistre les bâtiments de performance et leurs paliers complets", () => {
    expect(isTeamInfrastructureCode("training_center")).toBe(true);
    expect(isTeamInfrastructureCode("roster_management_center")).toBe(true);
    expect(isTeamInfrastructureCode("indoor_track")).toBe(true);
    expect(isTeamInfrastructureCode("cryotherapy_center")).toBe(true);
    expect(isTeamInfrastructureCode("wind_tunnel")).toBe(true);
    expect(isTeamInfrastructureCode("research_lab")).toBe(true);
    expect(isTeamInfrastructureCode("international_welcome_center")).toBe(true);
    expect(isTeamInfrastructureCode("weather_center")).toBe(true);
    expect(isTeamInfrastructureCode("tactical_center")).toBe(true);
    expect(isTeamInfrastructureCode("media_center")).toBe(true);
    expect(isTeamInfrastructureCode("fan_club_headquarters")).toBe(true);
    expect(isTeamInfrastructureCode("club_shop")).toBe(true);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.fan_club_headquarters.levels,
    ).toHaveLength(5);
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.club_shop.levels).toHaveLength(5);
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.indoor_track.levels).toHaveLength(5);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.cryotherapy_center.levels,
    ).toHaveLength(5);
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.wind_tunnel.levels).toHaveLength(5);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.roster_management_center.levels,
    ).toHaveLength(5);
    // Kept only to decode historical projects and levels; no longer offered.
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.tactical_center.levels,
    ).toHaveLength(5);
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.research_lab.levels).toHaveLength(7);
    for (const code of getTeamInfrastructureCodesByStartingCost()) {
      const costs = TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.map(
        (level) => level.cost,
      );
      expect(
        costs.every((cost, index) => index === 0 || cost > costs[index - 1]!),
      ).toBe(true);
    }
    expect(INTERNATIONAL_CENTER_LEVELS.map((level) => level.cost)).toEqual([
      500_000, 800_000, 1_200_000, 1_700_000, 2_300_000,
    ]);
  });

  it("intègre l’efficacité de l’architecte dans la qualité partagée", () => {
    expect(applyInfrastructureEfficiencyBonus(5, 10)).toBe(5.5);
    expect(getInternationalCenterBonusPercentage(5.5)).toBe(5);
  });
});

describe("infrastructure tariff parity", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260919020000_progressive_team_infrastructure_costs.sql",
    ),
    "utf8",
  );
  const rosterManagementMigration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260921130000_create_team_roster_management_center.sql",
    ),
    "utf8",
  );

  it("uses the exact same prices in the database and the displayed catalogue", () => {
    const schedules = new Map(
      [
        ...`${migration}\n${rosterManagementMigration}`.matchAll(
          /when '([a-z_]+)' then v_costs := array\[([\d, ]+)\];/g,
        ),
      ].map(
        ([, code, prices]) =>
          [
            code,
            prices!.split(",").map((price) => Number(price.trim())),
          ] as const,
      ),
    );

    for (const [code, definition] of Object.entries(
      TEAM_INFRASTRUCTURE_DEFINITIONS,
    )) {
      expect(schedules.get(code)).toEqual(
        definition.levels.map((level) => level.cost),
      );
    }
    expect(schedules.get("international_youth_center")).toEqual(
      INTERNATIONAL_CENTER_LEVELS.map((level) => level.cost),
    );
    expect(schedules.size).toBe(
      Object.keys(TEAM_INFRASTRUCTURE_DEFINITIONS).length + 1,
    );
  });

  it("quotes the new base price before architect discounts without rewriting existing projects", () => {
    expect(migration).toContain(
      "v_base_cost := public.get_team_infrastructure_base_cost(",
    );
    expect(migration).toContain("if p_architect_contract_id is not null then");
    expect(migration).not.toMatch(
      /update\s+public\.(?:infrastructure_projects|team_seasons)/i,
    );
  });
});
