import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  applyInfrastructureEfficiencyBonus,
  applyInternationalCenterPotentialBonus,
  canDirectorBuildInfrastructureLevel,
  getRequiredDirectorLevelForInfrastructureLevel,
  getStaffNaturalizationSeasonLimit,
  getTeamInfrastructureCodesByStartingCost,
  getInternationalCenterBonusPercentage,
  isTeamInfrastructureCode,
  getScoutingVisibilityForDataRoom,
} from "@/lib/game/infrastructure";

describe("international cycling schools", () => {
  it("adds one full potential star when the shared country roll succeeds", () => {
    expect(
      applyInternationalCenterPotentialBonus({
        potentialSteps: 5,
        totalQualityStars: 3,
        random: () => 0.29,
      }),
    ).toEqual({
      potentialSteps: 7,
      bonusApplied: true,
      bonusPercentage: 30,
    });
  });

  it("never exceeds four stars and caps the shared chance", () => {
    expect(getInternationalCenterBonusPercentage(14)).toBe(90);
    expect(
      applyInternationalCenterPotentialBonus({
        potentialSteps: 7,
        totalQualityStars: 14,
        random: () => 0,
      }),
    ).toEqual({
      potentialSteps: 7,
      bonusApplied: false,
      bonusPercentage: 90,
    });
  });
});

describe("recruitment Data Room", () => {
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
      "training_center",
      "club_shop",
      "indoor_track",
      "fan_club_headquarters",
      "cryotherapy_center",
      "recruitment_data_room",
      "wind_tunnel",
      "weather_center",
      "media_center",
      "international_welcome_center",
      "research_lab",
      "staff_academy",
    ]);
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

  it("garde le niveau 1 cher puis facture les améliorations moins cher", () => {
    const levels = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center.levels;

    expect(levels.map((level) => level.cost)).toEqual([
      100_000, 60_000, 70_000, 80_000, 90_000,
    ]);
    expect(levels.at(-1)?.effect).toContain("+10 %");
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
    expect(isTeamInfrastructureCode("indoor_track")).toBe(true);
    expect(isTeamInfrastructureCode("cryotherapy_center")).toBe(true);
    expect(isTeamInfrastructureCode("wind_tunnel")).toBe(true);
    expect(isTeamInfrastructureCode("research_lab")).toBe(true);
    expect(isTeamInfrastructureCode("international_welcome_center")).toBe(true);
    expect(isTeamInfrastructureCode("weather_center")).toBe(true);
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
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.research_lab.levels).toHaveLength(7);
    for (const code of getTeamInfrastructureCodesByStartingCost()) {
      const costs = TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.map(
        (level) => level.cost,
      );
      expect(costs.slice(1).every((cost) => cost < costs[0]!)).toBe(true);
      expect(costs.slice(1)).toEqual(
        [...costs.slice(1)].sort((left, right) => left - right),
      );
    }
  });

  it("intègre l’efficacité de l’architecte dans la qualité partagée", () => {
    expect(applyInfrastructureEfficiencyBonus(5, 10)).toBe(5.5);
    expect(getInternationalCenterBonusPercentage(5.5)).toBe(55);
  });
});
