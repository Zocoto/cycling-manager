import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  STAFF_TUTORIAL_KEY,
  STAFF_TUTORIAL_MARKET_STEP_KEYS,
  STAFF_TUTORIAL_TEAM_STEP_KEY,
} from "@/lib/tutorial/staff";

describe("staff tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(STAFF_TUTORIAL_KEY)).toMatchObject({
      key: STAFF_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("couvre le niveau du DS, le marché, les filtres, les métiers et le staff", () => {
    const definition = getTutorialDefinition(STAFF_TUTORIAL_KEY);
    const stepKeys = new Set(definition?.steps.map((step) => step.key));

    for (const stepKey of [
      "staff-overview",
      "staff-capacity",
      "staff-tabs",
      ...STAFF_TUTORIAL_MARKET_STEP_KEYS,
      STAFF_TUTORIAL_TEAM_STEP_KEY,
    ]) {
      expect(stepKeys).toContain(stepKey);
    }
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });

  it("présente les neuf métiers et le caractère unique des profils", () => {
    const professionStep = getTutorialDefinition(
      STAFF_TUTORIAL_KEY,
    )?.steps.find((step) => step.key === "staff-professions");

    for (const job of [
      "entraîneur",
      "scout",
      "médecin",
      "kiné",
      "nutritionniste",
      "mécanicien",
      "préparateur de parcours",
      "architecte",
      "community manager",
    ]) {
      expect(professionStep?.content.toLocaleLowerCase("fr")).toContain(job);
    }
    expect(professionStep?.content).toContain("Chaque personne est unique");
  });
});
