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

  it("cible la note du profil et la moitié du bonus sur ACC, END et RES", () => {
    expect(
      applyFanClubRaceRatingBoost({
        ratings: {
          mountain: 70,
          hills: 99.5,
          acceleration: 70,
          endurance: 70,
          resistance: 70,
          recovery: 70,
          downhill: 70,
        },
        ratingBoost: 1.1,
        profileType: "mountain",
        stageType: "road",
      }),
    ).toEqual({
      mountain: 71.1,
      hills: 99.5,
      acceleration: 70.55,
      endurance: 70.55,
      resistance: 70.55,
      recovery: 70,
      downhill: 70,
    });
  });

  it("cible le CLM ou le prologue selon la discipline de l’étape", () => {
    const ratings = { timeTrial: 70, prologue: 70, resistance: 70 };

    expect(
      applyFanClubRaceRatingBoost({
        ratings,
        ratingBoost: 1,
        profileType: "flat",
        stageType: "individual_time_trial",
      }),
    ).toEqual({ timeTrial: 71, prologue: 70, resistance: 70.5 });
    expect(
      applyFanClubRaceRatingBoost({
        ratings,
        ratingBoost: 1,
        profileType: "flat",
        stageType: "prologue",
      }),
    ).toEqual({ timeTrial: 70, prologue: 71, resistance: 70.5 });
  });
});
