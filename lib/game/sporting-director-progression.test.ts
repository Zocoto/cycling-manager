import { describe, expect, it } from "vitest";

import {
  calculateSportingDirectorProgression,
  getExperienceRequiredForNextLevel,
} from "./sporting-director-progression";
import { getStaffCapacityForDirectorLevel } from "./staff";
import { canDirectorBuildInfrastructureLevel } from "./infrastructure";

describe("calculateSportingDirectorProgression", () => {
  it("commence au niveau 1 avec zéro point d’expérience", () => {
    expect(
      calculateSportingDirectorProgression(0)
    ).toEqual({
      level: 1,
      totalExperiencePoints: 0,
      experienceIntoLevel: 0,
      experienceRequiredForNextLevel: 100,
      progressPercentage: 0,
    });
  });

  it("progresse dans le premier niveau", () => {
    const progression =
      calculateSportingDirectorProgression(50);

    expect(progression.level).toBe(1);
    expect(progression.experienceIntoLevel).toBe(
      50
    );
    expect(
      progression.experienceRequiredForNextLevel
    ).toBe(100);
    expect(progression.progressPercentage).toBe(
      50
    );
  });

  it("passe au niveau 2 après 100 points d’expérience", () => {
    const progression =
      calculateSportingDirectorProgression(100);

    expect(progression.level).toBe(2);
    expect(progression.experienceIntoLevel).toBe(
      0
    );
    expect(
      progression.experienceRequiredForNextLevel
    ).toBe(150);
    expect(progression.progressPercentage).toBe(
      0
    );
  });

  it("conserve l’expérience excédentaire après un changement de niveau", () => {
    const progression =
      calculateSportingDirectorProgression(175);

    expect(progression.level).toBe(2);
    expect(progression.experienceIntoLevel).toBe(
      75
    );
    expect(
      progression.experienceRequiredForNextLevel
    ).toBe(150);
    expect(progression.progressPercentage).toBe(
      50
    );
  });

  it("peut franchir plusieurs niveaux", () => {
    const progression =
      calculateSportingDirectorProgression(450);

    expect(progression.level).toBe(4);
    expect(progression.experienceIntoLevel).toBe(
      0
    );
    expect(
      progression.experienceRequiredForNextLevel
    ).toBe(250);
  });

  it("neutralise les valeurs négatives et décimales", () => {
    expect(
      calculateSportingDirectorProgression(-50)
        .totalExperiencePoints
    ).toBe(0);

    expect(
      calculateSportingDirectorProgression(74.9)
        .totalExperiencePoints
    ).toBe(74);
  });

  it("continues the existing curve at the former level-50 cap", () => {
    const progression =
      calculateSportingDirectorProgression(
        63_700,
      );

    expect(progression).toMatchObject({
      level: 50,
      totalExperiencePoints: 63_700,
      experienceIntoLevel: 0,
      experienceRequiredForNextLevel: 2_550,
      progressPercentage: 0,
    });
  });

  it.each([
    [64_700, 50, 1_000, 2_550],
    [66_249, 50, 2_549, 2_550],
    [66_250, 51, 0, 2_600],
    [68_850, 52, 0, 2_650],
    [113_700, 66, 3_200, 3_350],
    [252_450, 100, 0, 5_050],
  ])("keeps %i XP and shows level %i", (xp, level, into, required) => {
    expect(calculateSportingDirectorProgression(xp)).toMatchObject({
      totalExperiencePoints: xp, level, experienceIntoLevel: into,
      experienceRequiredForNextLevel: required,
    });
  });

  it("matches the historical step-by-step curve on both sides of 10,000 thresholds", () => {
    let consumed = 0;
    for (let level = 1; level <= 10_000; level += 1) {
      const atThreshold = calculateSportingDirectorProgression(consumed);
      expect(atThreshold.level).toBe(level);
      expect(atThreshold.experienceIntoLevel).toBe(0);
      if (level > 1) expect(calculateSportingDirectorProgression(consumed - 1).level).toBe(level - 1);
      consumed += getExperienceRequiredForNextLevel(level);
    }
  });

  it.each([NaN, Infinity, -Infinity])("handles invalid input %s without invalid progress", xp => {
    expect(calculateSportingDirectorProgression(xp)).toEqual(calculateSportingDirectorProgression(0));
  });

  it.each([2_147_483_647, Number.MAX_SAFE_INTEGER])("keeps valid progress for a large integer %i", xp => {
    const value = calculateSportingDirectorProgression(xp);
    expect(value.totalExperiencePoints).toBe(xp);
    expect(value.level).toBeGreaterThan(50);
    expect(value.experienceIntoLevel).toBeGreaterThanOrEqual(0);
    expect(value.experienceIntoLevel).toBeLessThan(value.experienceRequiredForNextLevel);
    expect(value.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(value.progressPercentage).toBeLessThan(100);
  });

  it("adds no staff capacity or building access beyond the existing level-50 rules", () => {
    for (const level of [51, 66, 100, 9267]) {
      expect(getStaffCapacityForDirectorLevel(level)).toBe(getStaffCapacityForDirectorLevel(50));
      for (let buildingLevel = 1; buildingLevel <= 10; buildingLevel += 1) {
        expect(canDirectorBuildInfrastructureLevel(level, buildingLevel)).toBe(canDirectorBuildInfrastructureLevel(50, buildingLevel));
      }
    }
  });
});

describe("getExperienceRequiredForNextLevel", () => {
  it("augmente le seuil de 50 points par niveau", () => {
    expect(
      getExperienceRequiredForNextLevel(1)
    ).toBe(100);

    expect(
      getExperienceRequiredForNextLevel(2)
    ).toBe(150);

    expect(
      getExperienceRequiredForNextLevel(5)
    ).toBe(300);
  });

  it("keeps the historical total needed to reach level 50", () => {
    const experienceRequiredForLevel50 = Array.from(
      { length: 49 },
      (_, index) =>
        getExperienceRequiredForNextLevel(index + 1),
    ).reduce((total, threshold) => total + threshold, 0);

    expect(experienceRequiredForLevel50).toBe(
      63_700,
    );
  });
});
