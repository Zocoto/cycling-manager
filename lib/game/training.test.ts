import { describe, expect, it } from "vitest";

import {
  calculateDailyTrainingProgressMilli,
  formatTrainingProgressMilli,
  getPotentialEfficiency,
  getPotentialOverallCap,
  getPotentialStars,
  getRatingProgressFactor,
  getSeasonDeclinePoints,
  getSeasonRatingGainCap,
  getSkippedTrainingFormDelta,
  getTrainerMultiplier,
  getTrainingDomainWeight,
  getTrainingFormDelta,
  indexLatestTrainingSessionsByRider,
} from "@/lib/game/training";

describe("rider potential", () => {
  it("maps the eight half-star steps to the expected overall caps", () => {
    expect(
      Array.from({ length: 8 }, (_, index) => getPotentialOverallCap(index + 1)),
    ).toEqual([65, 70, 75, 80, 85, 90, 95, 100]);
    expect(getPotentialStars(1)).toBe(0.5);
    expect(getPotentialStars(8)).toBe(4);
    expect(getPotentialEfficiency(1)).toBeCloseTo(0.65);
    expect(getPotentialEfficiency(8)).toBe(1);
  });
});

describe("training form", () => {
  it("interpolates the agreed recovery and form-loss thresholds", () => {
    expect([0, 25, 50, 60, 70, 80, 90, 100].map(getTrainingFormDelta)).toEqual([
      2, 1, 0, -5, -10, -15, -20, -25,
    ]);
  });

  it("restores two form points only when the DS threshold cancels training", () => {
    expect(getSkippedTrainingFormDelta("skipped_low_form")).toBe(2);
    expect(getSkippedTrainingFormDelta("skipped_injury")).toBe(0);
    expect(getSkippedTrainingFormDelta("skipped_form_camp")).toBe(0);
  });
});

describe("training progression", () => {
  it("favours primary stats while keeping a small outside-domain progression", () => {
    expect(getTrainingDomainWeight("climber", "mountain")).toBe(1);
    expect(getTrainingDomainWeight("climber", "hills")).toBe(0.55);
    expect(getTrainingDomainWeight("climber", "sprint")).toBe(0.1);
  });

  it("applies a trainer bonus only to the matching statistics", () => {
    expect(
      getTrainerMultiplier({ specialty: "sprint", level: 5, ratingKey: "sprint" }),
    ).toBeCloseTo(1.2);
    expect(
      getTrainerMultiplier({ specialty: "sprint", level: 5, ratingKey: "mountain" }),
    ).toBe(1);
    expect(
      getTrainerMultiplier({
        specialty: "sprint",
        level: 5,
        ratingKey: "mountain",
        countryMatch: true,
      }),
    ).toBeCloseTo(1.05);
    expect(
      getTrainerMultiplier({
        specialty: "sprint",
        level: 5,
        ratingKey: "sprint",
        countryMatch: true,
      }),
    ).toBeCloseTo(1.25);
  });

  it("makes low ratings progress faster and caps seasonal integer gains", () => {
    expect(getRatingProgressFactor(48)).toBeGreaterThan(getRatingProgressFactor(75));
    expect([45, 59, 60, 70, 80, 90].map(getSeasonRatingGainCap)).toEqual([
      18, 18, 12, 8, 4, 2,
    ]);
  });

  it("keeps the ideal above-60 progression near twelve points per season", () => {
    const daily = calculateDailyTrainingProgressMilli({
      intensity: 100,
      age: 20,
      potentialSteps: 8,
      rating: 65,
      domain: "climber",
      ratingKey: "mountain",
      trainerSpecialty: "mountain",
      trainerLevel: 5,
    });
    expect((daily * 28) / 1_000).toBeCloseTo(12, 1);
  });

  it("starts decline at 32 and never models growth for veteran riders", () => {
    expect(getSeasonDeclinePoints(31)).toBe(0);
    expect(getSeasonDeclinePoints(32)).toBe(1);
    expect(getSeasonDeclinePoints(36)).toBe(3);
  });
});

describe("training reports", () => {
  it("selects the highest season day even when backfilled sessions share a timestamp", () => {
    const processedAt = "2026-07-21T10:00:15.000Z";
    const latest = indexLatestTrainingSessionsByRider(
      [
        {
          rider_id: "rider-1",
          season_day_id: "day-1",
          processed_at: processedAt,
        },
        {
          rider_id: "rider-1",
          season_day_id: "day-5",
          processed_at: processedAt,
        },
      ],
      new Map([
        ["day-1", 1],
        ["day-5", 5],
      ]),
    );

    expect(latest.get("rider-1")?.season_day_id).toBe("day-5");
  });

  it("keeps the exact millipoint precision in the displayed gain", () => {
    expect(formatTrainingProgressMilli(357)).toBe("0,357");
    expect(formatTrainingProgressMilli(1_000)).toBe("1,000");
  });
});
