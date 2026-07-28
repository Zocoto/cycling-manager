import { describe, expect, it } from "vitest";

import {
  getRiderExperience,
  getRiderExperienceRaceBonus,
  getRiderExperienceScore,
  RIDER_EXPERIENCE_MAX_RACE_BONUS,
  RIDER_EXPERIENCE_RACE_DAYS_FOR_MAX_SCORE,
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

  it("attribue 0,2 point d'expérience par jour de course", () => {
    expect(getRiderExperienceScore(0)).toBe(0);
    expect(getRiderExperienceScore(1)).toBe(0.2);
    expect(getRiderExperienceScore(10)).toBe(2);
    expect(getRiderExperienceScore(39)).toBe(7.8);
    expect(
      getRiderExperienceScore(RIDER_EXPERIENCE_RACE_DAYS_FOR_MAX_SCORE),
    ).toBe(100);
    expect(getRiderExperienceScore(10_000)).toBe(100);
  });

  it("plafonne le bonus de course à un avantage mesuré", () => {
    expect(getRiderExperienceRaceBonus(250)).toBeCloseTo(0.75, 3);
    expect(getRiderExperienceRaceBonus(10_000)).toBe(
      RIDER_EXPERIENCE_MAX_RACE_BONUS,
    );
  });

  it("attribue un niveau lisible sur la fiche du coureur", () => {
    expect(getRiderExperience(99).level).toBe("Débutant");
    expect(getRiderExperience(100).level).toBe("En apprentissage");
    expect(getRiderExperience(200).level).toBe("Confirmé");
    expect(getRiderExperience(300).level).toBe("Expérimenté");
    expect(getRiderExperience(400).level).toBe("Vétéran");
  });
});
