import { describe, expect, it } from "vitest";

import {
  calculateDevelopmentPodiumProgression,
  getDevelopmentPodiumPlaceFactor,
  getDevelopmentPodiumRatingFactor,
} from "@/lib/game/development-podium-progression";
import type { RiderRatings } from "@/lib/game/rider-profile";

const ratingsAt = (value: number): RiderRatings => ({
  mountain: value,
  hills: value,
  recovery: value,
  endurance: value,
  resistance: value,
  breakaway: value,
  downhill: value,
  acceleration: value,
  sprint: value,
  flat: value,
  cobbles: value,
  prologue: value,
  timeTrial: value,
});

describe("development podium progression", () => {
  it("awards the full primary point only to a winner below 70", () => {
    expect(
      calculateDevelopmentPodiumProgression({
        rank: 1,
        profile: "mountain",
        ratings: ratingsAt(69),
      }),
    ).toEqual({
      mountain: 1,
      recovery: 0.18,
      endurance: 0.17,
      resistance: 0.13,
      downhill: 0.1,
    });
  });

  it("decreases the gain for second and third place", () => {
    expect(getDevelopmentPodiumPlaceFactor(1)).toBe(1);
    expect(getDevelopmentPodiumPlaceFactor(2)).toBe(0.6);
    expect(getDevelopmentPodiumPlaceFactor(3)).toBe(0.35);
    expect(getDevelopmentPodiumPlaceFactor(4)).toBe(0);

    expect(
      calculateDevelopmentPodiumProgression({
        rank: 2,
        profile: "flat",
        ratings: ratingsAt(60),
      }).flat,
    ).toBe(0.6);
    expect(
      calculateDevelopmentPodiumProgression({
        rank: 3,
        profile: "flat",
        ratings: ratingsAt(60),
      }).flat,
    ).toBe(0.35);
  });

  it("slows every affected rating independently above 70", () => {
    expect(getDevelopmentPodiumRatingFactor(69.99)).toBe(1);
    expect(getDevelopmentPodiumRatingFactor(72)).toBe(0.65);
    expect(getDevelopmentPodiumRatingFactor(75)).toBe(0.4);
    expect(getDevelopmentPodiumRatingFactor(80)).toBe(0.25);

    const ratings = ratingsAt(60);
    ratings.cobbles = 75;
    ratings.flat = 72;
    expect(
      calculateDevelopmentPodiumProgression({
        rank: 1,
        profile: "cobbles",
        ratings,
      }),
    ).toMatchObject({ cobbles: 0.4, flat: 0.124 });
  });

  it("uses endurance as the main reward for a mixed stage race", () => {
    expect(
      calculateDevelopmentPodiumProgression({
        rank: 1,
        profile: "mixed",
        ratings: ratingsAt(65),
      }).endurance,
    ).toBe(1);
  });

  it("never exceeds a displayed rating of 100", () => {
    const ratings = ratingsAt(60);
    ratings.timeTrial = 99.8;
    expect(
      calculateDevelopmentPodiumProgression({
        rank: 1,
        profile: "time_trial",
        ratings,
      }).timeTrial,
    ).toBe(0.2);
  });
});
