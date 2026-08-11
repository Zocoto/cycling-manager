import { describe, expect, it } from "vitest";

import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  applyInternationalCenterPotentialBonus,
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
  it("starts the training center at 100,000 euros and raises prices progressively", () => {
    const levels = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center.levels;

    expect(levels.map((level) => level.cost)).toEqual([
      100_000,
      250_000,
      500_000,
      900_000,
      1_500_000,
    ]);
    expect(levels.map((level) => level.cost)).toEqual(
      [...levels].map((level) => level.cost).sort((left, right) => left - right),
    );
    expect(levels.at(-1)?.effect).toContain("+10 %");
  });

  it("registers the training center and both fan club buildings", () => {
    expect(isTeamInfrastructureCode("training_center")).toBe(true);
    expect(isTeamInfrastructureCode("fan_club_headquarters")).toBe(true);
    expect(isTeamInfrastructureCode("club_shop")).toBe(true);
    expect(
      TEAM_INFRASTRUCTURE_DEFINITIONS.fan_club_headquarters.levels,
    ).toHaveLength(5);
    expect(TEAM_INFRASTRUCTURE_DEFINITIONS.club_shop.levels).toHaveLength(5);
  });
});
