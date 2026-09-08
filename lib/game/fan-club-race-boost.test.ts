import { describe, expect, it } from "vitest";

import {
  applyFanClubRaceRatingBoost,
  calculateFanClubRaceBoost,
} from "./fan-club-race-boost";

describe("bonus de course des supporters", () => {
  it("combine les places de plusieurs cars et la ferveur", () => {
    const boost = calculateFanClubRaceBoost({
      supporterCount: 12_480,
      fervor: 74,
      allocations: [
        { modelCode: "regional", carCount: 1 },
        { modelCode: "double-etage", carCount: 2 },
      ],
    });

    expect(boost).toMatchObject({
      carCount: 3,
      seatCapacity: 200,
      availableSupporters: 4_992,
      mobilizedSupporters: 200,
      fervorMultiplier: 0.74,
      ratingBoost: 1.05,
      projectedMountainRatingAt70: 71.05,
    });
  });

  it("plafonne les voyageurs disponibles et le bonus à trois points", () => {
    expect(
      calculateFanClubRaceBoost({
        supporterCount: 100,
        fervor: 100,
        seatCapacity: 2_400,
      }).mobilizedSupporters,
    ).toBe(40);
    expect(
      calculateFanClubRaceBoost({
        supporterCount: 10_000,
        fervor: 100,
        seatCapacity: 2_400,
      }).ratingBoost,
    ).toBe(3);
  });

  it("applique le même encouragement aux notes de course sans dépasser 100", () => {
    expect(
      applyFanClubRaceRatingBoost(
        { mountain: 70, hills: 99.5 },
        1.1,
      ),
    ).toEqual({ mountain: 71.1, hills: 100 });
  });
});
