import { describe, expect, it } from "vitest";

import {
  applyInternationalCenterPotentialBonus,
  getInternationalCenterBonusPercentage,
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
