import { describe, expect, it } from "vitest";

import {
  calculateDailyTrainingProgressMilli,
  getDailyDeclineMilli,
  formatTrainingProgressMilli,
  getPotentialEfficiency,
  getPotentialOverallCap,
  getPotentialStars,
  getLongevityTier,
  getNaturalDeclineMultiplierFromRoll,
  getRatingProgressFactor,
  getSeasonDeclinePoints,
  getSeasonRatingGainCap,
  getSkippedTrainingFormDelta,
  getTrainerMultiplier,
  getTrainerRiderCapacity,
  getTrainingDomainWeight,
  getTrainingFormDelta,
  indexLatestTrainingSessionsByRider,
  parseTrainingPageTab,
  validateRecognitionCampSchedule,
} from "@/lib/game/training";

describe("training page tabs", () => {
  it("affiche les entraînements par défaut et reconnaît le second onglet", () => {
    expect(parseTrainingPageTab(undefined)).toBe("training");
    expect(parseTrainingPageTab("inconnu")).toBe("training");
    expect(parseTrainingPageTab(["reconnaissance"])).toBe("training");
    expect(parseTrainingPageTab("reconnaissance")).toBe("reconnaissance");
  });
});

describe("recognition camp scheduling", () => {
  it("allows a two-day camp well before the target stage", () => {
    expect(
      validateRecognitionCampSchedule({
        currentDayNumber: 8,
        startDayNumber: 12,
        targetStageDayNumber: 16,
        targetEditionStartDayNumber: 14,
        targetEditionEndDayNumber: 18,
      }),
    ).toEqual({
      valid: true,
      startDayNumber: 12,
      endDayNumber: 13,
    });
  });

  it("blocks either preparation day when it overlaps the target stage race", () => {
    expect(
      validateRecognitionCampSchedule({
        currentDayNumber: 8,
        startDayNumber: 13,
        targetStageDayNumber: 16,
        targetEditionStartDayNumber: 14,
        targetEditionEndDayNumber: 18,
      }),
    ).toEqual({
      valid: false,
      error:
        "Le stage chevauche la course par étapes qui englobe l’étape ciblée.",
    });
  });

  it("requires both camp days to finish before the target stage", () => {
    expect(
      validateRecognitionCampSchedule({
        currentDayNumber: 8,
        startDayNumber: 15,
        targetStageDayNumber: 16,
        targetEditionStartDayNumber: 16,
        targetEditionEndDayNumber: 16,
      }),
    ).toEqual({
      valid: false,
      error:
        "Les deux jours de préparation doivent être terminés avant l’étape ciblée.",
    });
  });

  it("rejects a camp starting on the current day", () => {
    expect(
      validateRecognitionCampSchedule({
        currentDayNumber: 8,
        startDayNumber: 8,
        targetStageDayNumber: 16,
        targetEditionStartDayNumber: 16,
        targetEditionEndDayNumber: 16,
      }),
    ).toEqual({
      valid: false,
      error: "Le stage doit commencer après la journée actuelle.",
    });
  });
});

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
  it("limits trainer groups from four to eight riders according to level", () => {
    expect([1, 2, 3, 4, 5].map(getTrainerRiderCapacity)).toEqual([4, 5, 6, 7, 8]);
  });

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

  it("accélère le déclin de façon composée après 32 ans", () => {
    expect(getSeasonDeclinePoints(31)).toBe(0);
    expect(getSeasonDeclinePoints(32)).toBeCloseTo(3.6);
    expect(getSeasonDeclinePoints(38)).toBeGreaterThan(
      getSeasonDeclinePoints(32) * 1.3,
    );
    expect(getSeasonDeclinePoints(40)).toBeCloseTo(5.32, 1);
  });

  it("crée rarement une longévité naturelle exceptionnelle", () => {
    expect(getNaturalDeclineMultiplierFromRoll(0)).toBe(0.65);
    expect(getNaturalDeclineMultiplierFromRoll(99)).toBe(0.65);
    expect(getNaturalDeclineMultiplierFromRoll(100)).toBe(0.8);
    expect(getNaturalDeclineMultiplierFromRoll(599)).toBe(0.8);
    expect(getNaturalDeclineMultiplierFromRoll(600)).toBe(0.92);
    expect(getNaturalDeclineMultiplierFromRoll(2_199)).toBe(0.92);
    expect(getNaturalDeclineMultiplierFromRoll(2_200)).toBe(1);
    expect(getLongevityTier(0.65)).toBe("exceptional");
  });

  it("repousse et réduit le déclin avec Santé de fer", () => {
    expect(getSeasonDeclinePoints(32, { hasIronHealth: true })).toBe(0);
    expect(
      getDailyDeclineMilli(38, { hasIronHealth: true }),
    ).toBeLessThan(getDailyDeclineMilli(38) * 0.7);
  });

  it("reproduit la trajectoire d’un ancien pic à 85 bien entraîné", () => {
    expect(simulateVeteranMountainRating(85, 32, 36)).toBe(78);
    expect(simulateVeteranMountainRating(85, 32, 40)).toBe(71);
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
function simulateVeteranMountainRating(
  initialRating: number,
  startAge: number,
  endAge: number,
) {
  let rating = initialRating;

  for (let age = startAge; age <= endAge; age += 1) {
    const seasonInitialRating = rating;
    let balanceMilli = 0;

    for (let day = 1; day <= 28; day += 1) {
      balanceMilli +=
        calculateDailyTrainingProgressMilli({
          intensity: 100,
          age,
          potentialSteps: 8,
          rating,
          domain: "climber",
          ratingKey: "mountain",
          trainerSpecialty: "mountain",
          trainerLevel: 5,
          trainerCountryMatch: true,
        }) - getDailyDeclineMilli(age);

      if (balanceMilli <= -1_000) {
        const loss = Math.min(Math.floor(Math.abs(balanceMilli) / 1_000), rating);
        rating -= loss;
        balanceMilli += loss * 1_000;
      } else if (balanceMilli >= 1_000 && rating < seasonInitialRating) {
        const gain = Math.min(
          Math.floor(balanceMilli / 1_000),
          seasonInitialRating - rating,
        );
        rating += gain;
        balanceMilli -= gain * 1_000;
      } else if (rating >= seasonInitialRating) {
        balanceMilli = Math.min(balanceMilli, 999);
      }
    }
  }

  return rating;
}
