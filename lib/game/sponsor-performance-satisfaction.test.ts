import { describe, expect, it } from "vitest";

import {
  calculateSponsorSatisfactionScore,
  isSponsorPerformanceSatisfactionEnabled,
} from "./sponsor-performance-satisfaction";

describe("sponsor performance satisfaction", () => {
  it("n’applique aucun bonus sportif avant la saison 3", () => {
    expect(isSponsorPerformanceSatisfactionEnabled(2)).toBe(false);
    expect(
      calculateSponsorSatisfactionScore({
        objectivePoints: 42,
        performancePoints: 25,
        gameYear: 2,
      }),
    ).toBe(42);
  });

  it("ajoute les performances aux objectifs à partir de la saison 3", () => {
    expect(isSponsorPerformanceSatisfactionEnabled(3)).toBe(true);
    expect(
      calculateSponsorSatisfactionScore({
        objectivePoints: 42,
        performancePoints: 8,
        gameYear: 3,
      }),
    ).toBe(50);
  });

  it("plafonne le bonus sportif à 25 points et la satisfaction à 100", () => {
    expect(
      calculateSponsorSatisfactionScore({
        objectivePoints: 80,
        performancePoints: 40,
        gameYear: 3,
      }),
    ).toBe(100);
    expect(
      calculateSponsorSatisfactionScore({
        objectivePoints: 10,
        performancePoints: 40,
        gameYear: 3,
      }),
    ).toBe(35);
  });
});
