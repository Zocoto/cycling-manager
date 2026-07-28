import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
  YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
  YOUTH_DEVELOPMENT_TUTORIAL_KEY,
} from "@/lib/tutorial/youth-development";

describe("youth development tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(YOUTH_DEVELOPMENT_TUTORIAL_KEY)).toMatchObject({
      key: YOUTH_DEVELOPMENT_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("enchaîne la simulation de scouting avec l’école", () => {
    const definition = getTutorialDefinition(
      YOUTH_DEVELOPMENT_TUTORIAL_KEY,
    );

    expect(definition?.steps[0]?.route).toBe(
      YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
    );
    expect(
      definition?.steps.find((step) => step.key === "youth-academy")?.route,
    ).toBe(YOUTH_DEVELOPMENT_ACADEMY_ROUTE);
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });

  it("couvre la carte, la mission, le rapport, la signature et l’entraînement", () => {
    const targetIds = new Set(
      getTutorialDefinition(YOUTH_DEVELOPMENT_TUTORIAL_KEY)?.steps.flatMap(
        (step) => (step.targetId ? [step.targetId] : []),
      ),
    );

    for (const targetId of [
      "youth-tutorial-map",
      "youth-tutorial-filters",
      "youth-tutorial-mission-launch",
      "youth-tutorial-deadlines",
      "youth-tutorial-report",
      "youth-tutorial-signing",
      "youth-tutorial-academy",
      "youth-tutorial-training-settings",
      "youth-tutorial-minigame",
    ]) {
      expect(targetIds).toContain(targetId);
    }
  });
});
