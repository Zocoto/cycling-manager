import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
  TRAINING_TUTORIAL_KEY,
  TRAINING_TUTORIAL_ROUTE,
} from "@/lib/tutorial/training";

describe("training tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(TRAINING_TUTORIAL_KEY)).toMatchObject({
      key: TRAINING_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("enchaîne les réglages quotidiens avec le stage de reconnaissance", () => {
    const definition = getTutorialDefinition(TRAINING_TUTORIAL_KEY);
    const routes = new Set(definition?.steps.map((step) => step.route));

    expect(routes).toContain(TRAINING_TUTORIAL_ROUTE);
    expect(routes).toContain(TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE);
    expect(definition?.steps.at(-1)).toMatchObject({
      key: "complete",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
    });
  });

  it("couvre tous les réglages, rapports et choix de reconnaissance demandés", () => {
    const definition = getTutorialDefinition(TRAINING_TUTORIAL_KEY);
    const targetIds = new Set(
      definition?.steps.flatMap((step) =>
        step.targetId ? [step.targetId] : [],
      ),
    );

    for (const targetId of [
      "training-overview",
      "training-threshold",
      "training-staff",
      "training-plan-setup",
      "training-plan-intensity",
      "training-plan-domain",
      "training-plan-trainer",
      "training-plan-save",
      "training-report",
      "reconnaissance-overview",
      "reconnaissance-rider-selection",
      "reconnaissance-course-selection",
      "reconnaissance-date-planning",
      "reconnaissance-validation",
    ]) {
      expect(targetIds).toContain(targetId);
    }
  });
});