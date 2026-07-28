import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  ROSTER_TUTORIAL_KEY,
  ROSTER_TUTORIAL_RIDER_ROUTE,
} from "@/lib/tutorial/roster";

describe("roster tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    const definition = getTutorialDefinition(ROSTER_TUTORIAL_KEY);

    expect(definition).toMatchObject({
      key: ROSTER_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("enchaîne l’effectif avec la fiche dynamique du premier coureur", () => {
    const definition = getTutorialDefinition(ROSTER_TUTORIAL_KEY);
    const firstRiderStep = definition?.steps.find(
      (step) => step.key === "rider-overview",
    );

    expect(firstRiderStep).toMatchObject({
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      routeTargetId: "roster-rating-table",
      targetId: "rider-profile-overview",
    });
  });

  it("couvre chaque rubrique demandée de la fiche coureur", () => {
    const definition = getTutorialDefinition(ROSTER_TUTORIAL_KEY);
    const targetIds = new Set(
      definition?.steps.flatMap((step) =>
        step.targetId ? [step.targetId] : [],
      ),
    );

    for (const targetId of [
      "rider-profile-overview",
      "rider-profile-stats",
      "rider-profile-naturalization",
      "rider-profile-form",
      "rider-profile-abilities",
      "rider-profile-planning",
      "rider-profile-contract",
      "rider-profile-history",
      "rider-profile-equipment",
    ]) {
      expect(targetIds).toContain(targetId);
    }
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });
});
