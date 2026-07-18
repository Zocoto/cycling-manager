import { describe, expect, it } from "vitest";

import {
  calculateSportingDirectorProgression,
  getExperienceRequiredForNextLevel,
} from "./sporting-director-progression";

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
});
