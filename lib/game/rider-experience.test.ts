import { describe, expect, it } from "vitest";

import {
  getRiderExperience,
  getRiderExperienceRaceBonus,
  getRiderExperienceScore,
  RIDER_EXPERIENCE_MAX_RACE_BONUS,
} from "./rider-experience";

describe("rider experience", () => {
  it("normalise les jours de course invalides ou négatifs", () => {
    expect(getRiderExperience(-12)).toMatchObject({
      raceDays: 0,
      score: 0,
      level: "Débutant",
      raceBonus: 0,
    });
    expect(getRiderExperience(Number.NaN).raceDays).toBe(0);
  });

  it("progresse avec les jours de course tout en ralentissant avec l'expérience", () => {
    expect(getRiderExperienceScore(0)).toBe(0);
    expect(getRiderExperienceScore(180)).toBe(63);
    expect(getRiderExperienceScore(360)).toBe(86);

    const firstHundredDays =
      getRiderExperienceScore(100) - getRiderExperienceScore(0);
    const nextHundredDays =
      getRiderExperienceScore(200) - getRiderExperienceScore(100);

    expect(firstHundredDays).toBeGreaterThan(nextHundredDays);
  });

  it("plafonne le bonus de course à un avantage mesuré", () => {
    expect(getRiderExperienceRaceBonus(180)).toBeCloseTo(0.945, 3);
    expect(getRiderExperienceRaceBonus(10_000)).toBe(
      RIDER_EXPERIENCE_MAX_RACE_BONUS,
    );
  });

  it("attribue un niveau lisible sur la fiche du coureur", () => {
    expect(getRiderExperience(40).level).toBe("En apprentissage");
    expect(getRiderExperience(100).level).toBe("Confirmé");
    expect(getRiderExperience(180).level).toBe("Expérimenté");
    expect(getRiderExperience(360).level).toBe("Vétéran");
  });
});
