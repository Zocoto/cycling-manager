import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("guide public", () => {
  it("couvre les mécaniques structurantes ajoutées récemment", () => {
    for (const expected of [
      "Poids et morphologie",
      "Barème d’entraînement",
      "Moral",
      "Jonction des groupes",
      "Grupetto et délais",
      "Journal de course",
      "Courses régionales et locales",
      "Tous les barèmes de course",
      "Sponsor secondaire",
      "L’objectif principal",
      "Maintien de la notoriété",
      "Catalogue complet des bâtiments d’équipe",
      "Spécialisations des bâtiments fédéraux",
      "Équipe de développement",
    ]) {
      expect(source).toContain(expected);
    }
  });

  it("tire les chiffres sensibles des règles officielles", () => {
    for (const expectedImport of [
      "calculateRaceReward",
      "calculateStageReward",
      "FORM_CAMP_TYPES",
      "NUTRITION_INTERVENTIONS",
      "REPUTATION_TIERS",
      "PRESS_REPUTATION_COMMITMENTS",
      "WILDCARD_REPUTATION_COMMITMENTS",
      "TEAM_INFRASTRUCTURE_DEFINITIONS",
      "getTrainingDomainWeightGroups",
    ]) {
      expect(source).toContain(expectedImport);
    }

    expect(source).toContain("plus +10 % si les nationalités correspondent");
  });

  it("ne présente plus les anciennes informations obsolètes", () => {
    expect(source).not.toContain("juillet 2026");
    expect(source).not.toContain("Partiel ou en construction");
    expect(source).not.toContain("Development Team est encore en construction");
    expect(source).not.toContain("plus +5 % si les nationalités correspondent");
  });
});
