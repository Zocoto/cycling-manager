import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
  INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
  INFRASTRUCTURE_TUTORIAL_KEY,
} from "@/lib/tutorial/infrastructure";

describe("infrastructure tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(INFRASTRUCTURE_TUTORIAL_KEY)).toMatchObject({
      key: INFRASTRUCTURE_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("présente les bâtiments avant les écoles internationales", () => {
    const definition = getTutorialDefinition(INFRASTRUCTURE_TUTORIAL_KEY);
    const routes = definition?.steps.map((step) => step.route);

    expect(routes?.[0]).toBe(INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE);
    expect(routes).toContain(INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE);
    expect(
      routes?.findIndex(
        (route) => route === INFRASTRUCTURE_SCHOOLS_TUTORIAL_ROUTE,
      ),
    ).toBeGreaterThan(
      routes?.findLastIndex(
        (route) => route === INFRASTRUCTURE_BUILDINGS_TUTORIAL_ROUTE,
      ) ?? -1,
    );
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });

  it("explique les infrastructures actives et les Ã©coles", () => {
    const definition = getTutorialDefinition(INFRASTRUCTURE_TUTORIAL_KEY);
    const stepKeys = new Set(definition?.steps.map((step) => step.key));

    for (const stepKey of [
      "construction-rules",
      "recruitment-data-room",
      "staff-academy",
      "international-school-effect",
      "international-school-map",
    ]) {
      expect(stepKeys).toContain(stepKey);
    }
  });

  it("précise l’effet partagé, plafonné et non rétroactif des écoles", () => {
    const content = getTutorialDefinition(INFRASTRUCTURE_TUTORIAL_KEY)
      ?.steps.map((step) => step.content)
      .join(" ");

    expect(content).toContain("10 points de probabilité");
    expect(content).toContain("toutes les équipes");
    expect(content).toContain("90 %");
    expect(content).toContain("ne modifie pas rétroactivement");
  });

  it("annonce explicitement la validation dans le Centre des didacticiels", () => {
    const completionStep = getTutorialDefinition(
      INFRASTRUCTURE_TUTORIAL_KEY,
    )?.steps.at(-1);

    expect(completionStep?.content).toContain("Cliquez sur « Terminer »");
    expect(completionStep?.content).toContain("Centre des didacticiels");
  });
});
