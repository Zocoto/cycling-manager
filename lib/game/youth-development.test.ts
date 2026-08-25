import { describe, expect, it } from "vitest";

import {
  YOUTH_INITIAL_PROJECTED_OVERALL_MAX,
  YOUTH_RATING_KEYS,
  calculateCountryWorldReputationFromUciRank,
  calculateYouthScoutingQuality,
  calculateYouthProjectedOverall,
  calculateYouthSigningCosts,
  createSeededRandom,
  generateYouthPotentialSteps,
  generateYouthRatings,
  getScoutingCandidateCount,
  getYouthScoutingReportDetailLevel,
  rollYouthNativeSpecialAbility,
} from "@/lib/game/youth-development";
import { projectYouthRating } from "@/lib/game/youth-training";

describe("youth development", () => {
  it("keeps every junior rating between 1 and 6", () => {
    for (const archetype of ["climber", "puncheur", "stage_racer", "northern_classics", "rouleur", "breakaway", "sprinter", "all_rounder"] as const) {
      const ratings = generateYouthRatings({
        archetype,
        age: 18,
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
    const climber = generateYouthRatings({ archetype: "climber", age: 18, talent: 8, random: createSeededRandom("climber") });
    const sprinter = generateYouthRatings({ archetype: "sprinter", age: 18, talent: 8, random: createSeededRandom("sprinter") });
    expect(climber.sprint).toBeLessThanOrEqual(2.6);
    expect(sprinter.mountain).toBeLessThanOrEqual(2.5);
  });

  it("applies the scout bonus directly to a young rider's initial ratings", () => {
    const baseline = generateYouthRatings({
      archetype: "all_rounder",
      age: 17,
      talent: 5,
      random: createSeededRandom("same-candidate"),
    });
    const improved = generateYouthRatings({
      archetype: "all_rounder",
      age: 17,
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

  it("dérive la réputation uniquement du rang UCI national précédent", () => {
    expect(calculateCountryWorldReputationFromUciRank(1)).toBe(10);
    expect(calculateCountryWorldReputationFromUciRank(3)).toBe(10);
    expect(calculateCountryWorldReputationFromUciRank(4)).toBe(9);
    expect(calculateCountryWorldReputationFromUciRank(10)).toBe(8);
    expect(calculateCountryWorldReputationFromUciRank(31)).toBe(4);
    expect(calculateCountryWorldReputationFromUciRank(60)).toBe(2);
    expect(calculateCountryWorldReputationFromUciRank(null)).toBe(1);
  });

  it("rend les potentiels de deux et trois étoiles rares sans les rendre impossibles", () => {
    const weakQuality = calculateYouthScoutingQuality({
      scoutLevel: 1,
      durationDays: 3,
      facilityLevel: 1,
      countryReputation: 1,
      nationalityBonusPercentage: 0,
    });
    const strongQuality = calculateYouthScoutingQuality({
      scoutLevel: 5,
      durationDays: 7,
      facilityLevel: 10,
      countryReputation: 10,
      nationalityBonusPercentage: 15,
      scoutExpertiseBonus: 0.75,
      qualityMultiplier: 1.35,
    });
    const sampleSize = 20_000;
    const weak = Array.from({ length: sampleSize }, (_, index) =>
      generateYouthPotentialSteps({
        qualityScore: weakQuality,
        random: createSeededRandom(`weak-potential-${index}`),
      }),
    );
    const strong = Array.from({ length: sampleSize }, (_, index) =>
      generateYouthPotentialSteps({
        qualityScore: strongQuality,
        random: createSeededRandom(`strong-potential-${index}`),
      }),
    );
    const rateAtLeast = (sample: number[], steps: number) =>
      sample.filter((potential) => potential >= steps).length / sample.length;

    expect(weakQuality).toBe(0);
    expect(strongQuality).toBe(1);
    expect(rateAtLeast(weak, 4)).toBeLessThan(0.075);
    expect(rateAtLeast(weak, 6)).toBeLessThan(0.01);
    expect(rateAtLeast(strong, 4)).toBeGreaterThan(0.34);
    expect(rateAtLeast(strong, 6)).toBeGreaterThan(0.08);
    expect(
      generateYouthPotentialSteps({ qualityScore: 0, random: () => 0 }),
    ).toBe(8);
  });

  it("attribue rarement une capacité native cohérente avec le profil", () => {
    const sampleSize = 20_000;
    const weakCount = Array.from({ length: sampleSize }, (_, index) =>
      rollYouthNativeSpecialAbility({
        archetype: "sprinter",
        potentialSteps: 1,
        qualityScore: 0,
        random: createSeededRandom(`weak-ability-${index}`),
      }),
    ).filter(Boolean).length;
    const strongAbilities = Array.from({ length: sampleSize }, (_, index) =>
      rollYouthNativeSpecialAbility({
        archetype: "sprinter",
        potentialSteps: 8,
        qualityScore: 1,
        random: createSeededRandom(`strong-ability-${index}`),
      }),
    ).filter(Boolean);

    expect(weakCount / sampleSize).toBeLessThan(0.01);
    expect(strongAbilities.length / sampleSize).toBeGreaterThan(0.035);
    expect(strongAbilities.length / sampleSize).toBeLessThan(0.055);
    expect(new Set(strongAbilities)).toEqual(
      new Set(["pistard", "giclette", "locomotive"]),
    );
  });

  it("keeps signing and schooling affordable but meaningful", () => {
    const ratings = generateYouthRatings({ archetype: "puncheur", age: 17, talent: 5, random: createSeededRandom("cost") });
    const costs = calculateYouthSigningCosts({ potentialSteps: 5, ratings, countryReputation: 7 });
    expect(costs.signingFee).toBeGreaterThanOrEqual(5_000);
    expect(costs.signingFee).toBeLessThan(25_000);
    expect(costs.tuitionPerSeason).toBeGreaterThan(costs.signingFee / 2);
  });

  it("centre les statistiques principales sur les niveaux attendus selon l’âge", () => {
    const expectedMeans = [
      { age: 16, target: 46 },
      { age: 17, target: 49.8 },
      { age: 18, target: 58.6 },
    ];

    for (const expected of expectedMeans) {
      const sampleSize = 1_000;
      let primaryTotal = 0;

      for (let index = 0; index < sampleSize; index += 1) {
        const inputRandom = createSeededRandom(
          `calibration-input-${expected.age}-${index}`,
        );
        const ratings = generateYouthRatings({
          archetype: "climber",
          age: expected.age,
          talent: 1 + Math.floor(inputRandom() * 8),
          countryReputation: 1 + Math.floor(inputRandom() * 10),
          accuracyBonus: inputRandom() * 0.15,
          initialRatingBonus: inputRandom() * 0.3,
          random: createSeededRandom(
            `calibration-ratings-${expected.age}-${index}`,
          ),
        });
        primaryTotal +=
          (projectYouthRating(ratings.mountain) +
            projectYouthRating(ratings.endurance) +
            projectYouthRating(ratings.recovery)) /
          3;
      }

      expect(primaryTotal / sampleSize).toBeCloseTo(expected.target, 0);
    }
  });

  it("plafonne uniquement la moyenne générale générée au départ à 65", () => {
    const extremeRolls = [
      0,
      0.999,
      ...Array.from({ length: YOUTH_RATING_KEYS.length }, () => 0.999),
    ];
    const ratings = generateYouthRatings({
      archetype: "all_rounder",
      age: 18,
      talent: 8,
      countryReputation: 10,
      accuracyBonus: 0.15,
      initialRatingBonus: 0.3,
      random: () => extremeRolls.shift() ?? 0.999,
    });

    expect(calculateYouthProjectedOverall(ratings)).toBeLessThanOrEqual(
      YOUTH_INITIAL_PROJECTED_OVERALL_MAX,
    );
  });

  it("conserve des profils exceptionnels et valorise le pays et le scout", () => {
    const ordinary = generateYouthRatings({
      archetype: "climber",
      age: 16,
      talent: 3,
      countryReputation: 2,
      random: () => 0.5,
    });
    const exceptionalRolls = [
      0.1,
      0.1,
      0.2,
      0.5,
      0,
      0.9,
      ...Array.from({ length: 13 }, () => 0.5),
    ];
    const exceptional = generateYouthRatings({
      archetype: "climber",
      age: 16,
      talent: 8,
      countryReputation: 10,
      accuracyBonus: 0.15,
      initialRatingBonus: 0.3,
      scoutingQuality: 1,
      random: () => exceptionalRolls.shift() ?? 0.5,
    });

    expect(projectYouthRating(exceptional.mountain)).toBeGreaterThan(
      projectYouthRating(ordinary.mountain) + 8,
    );
  });

  it("crée des forces et faiblesses plus marquées sans lisser les profils", () => {
    const spreads = Array.from({ length: 1_000 }, (_, index) => {
      const ratings = generateYouthRatings({
        archetype: "stage_racer",
        age: 17,
        talent: 3,
        countryReputation: 5,
        random: createSeededRandom(`varied-profile-${index}`),
      });
      const values = YOUTH_RATING_KEYS.map((key) => ratings[key]);
      return Math.max(...values) - Math.min(...values);
    });
    const averageSpread =
      spreads.reduce((total, spread) => total + spread, 0) / spreads.length;

    expect(averageSpread).toBeGreaterThan(1.25);
    expect(spreads.filter((spread) => spread >= 1.4).length).toBeGreaterThan(
      500,
    );
  });

  it("affine le rapport avec le niveau du scout et la durée de mission", () => {
    expect(
      getYouthScoutingReportDetailLevel({ scoutLevel: 1, durationDays: 1 }),
    ).toBe(0);
    expect(
      getYouthScoutingReportDetailLevel({ scoutLevel: 3, durationDays: 5 }),
    ).toBe(1);
    expect(
      getYouthScoutingReportDetailLevel({ scoutLevel: 5, durationDays: 7 }),
    ).toBe(3);
  });
});
