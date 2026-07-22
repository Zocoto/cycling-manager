import { describe, expect, it } from "vitest";

import {
  YOUTH_RATING_KEYS,
  calculateCountryWorldReputation,
  calculateYouthSigningCosts,
  createSeededRandom,
  generateYouthRatings,
  getScoutingCandidateCount,
} from "@/lib/game/youth-development";

describe("youth development", () => {
  it("keeps every junior rating between 1 and 6", () => {
    for (const archetype of ["climber", "puncheur", "stage_racer", "northern_classics", "rouleur", "breakaway", "sprinter", "all_rounder"] as const) {
      const ratings = generateYouthRatings({
        archetype,
        talent: 8,
        accuracyBonus: 0.15,
        random: createSeededRandom(archetype),
      });
      for (const key of YOUTH_RATING_KEYS) {
        expect(ratings[key]).toBeGreaterThanOrEqual(1);
        expect(ratings[key]).toBeLessThanOrEqual(6);
      }
    }
  });

  it("does not generate a climber-sprinter contradiction", () => {
    const climber = generateYouthRatings({ archetype: "climber", talent: 8, random: createSeededRandom("climber") });
    const sprinter = generateYouthRatings({ archetype: "sprinter", talent: 8, random: createSeededRandom("sprinter") });
    expect(climber.sprint).toBeLessThanOrEqual(2.6);
    expect(sprinter.mountain).toBeLessThanOrEqual(2.5);
  });

  it("applies the scout bonus directly to a young rider's initial ratings", () => {
    const baseline = generateYouthRatings({
      archetype: "all_rounder",
      talent: 5,
      random: createSeededRandom("same-candidate"),
    });
    const improved = generateYouthRatings({
      archetype: "all_rounder",
      talent: 5,
      initialRatingBonus: 0.2,
      random: createSeededRandom("same-candidate"),
    });

    expect(
      YOUTH_RATING_KEYS.reduce(
        (total, key) => total + improved[key] - baseline[key],
        0,
      ),
    ).toBeGreaterThan(0);
    for (const key of YOUTH_RATING_KEYS) {
      expect(improved[key]).toBeGreaterThanOrEqual(baseline[key]);
    }
  });

  it("returns between one and four candidates and rewards better missions", () => {
    const weak = getScoutingCandidateCount({ scoutLevel: 1, durationDays: 1, facilityLevel: 1, random: () => 0 });
    const strong = getScoutingCandidateCount({ scoutLevel: 5, durationDays: 7, facilityLevel: 10, random: () => 0.99 });
    expect(weak).toBe(1);
    expect(strong).toBe(4);
  });

  it("allows several nations to reach a reputation of ten", () => {
    const dominantHistory = Array.from({ length: 10 }, () => 2_500);
    expect(calculateCountryWorldReputation({ baseReputation: 10, seasonUciPoints: dominantHistory })).toBe(10);
    expect(calculateCountryWorldReputation({ baseReputation: 8, seasonUciPoints: dominantHistory })).toBe(10);
  });

  it("keeps signing and schooling affordable but meaningful", () => {
    const ratings = generateYouthRatings({ archetype: "puncheur", talent: 5, random: createSeededRandom("cost") });
    const costs = calculateYouthSigningCosts({ potentialSteps: 5, ratings, countryReputation: 7 });
    expect(costs.signingFee).toBeGreaterThanOrEqual(5_000);
    expect(costs.signingFee).toBeLessThan(25_000);
    expect(costs.tuitionPerSeason).toBeGreaterThan(costs.signingFee / 2);
  });
});
