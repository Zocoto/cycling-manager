import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  MEDICAL_CENTER_TUTORIAL_KEY,
  MEDICAL_CENTER_TUTORIAL_ROUTES,
} from "@/lib/tutorial/medical-center";

describe("medical center tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(MEDICAL_CENTER_TUTORIAL_KEY)).toMatchObject({
      key: MEDICAL_CENTER_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("parcourt les cinq onglets du centre de soins", () => {
    const definition = getTutorialDefinition(MEDICAL_CENTER_TUTORIAL_KEY);
    const routes = new Set(definition?.steps.map((step) => step.route));

    for (const route of Object.values(MEDICAL_CENTER_TUTORIAL_ROUTES)) {
      expect(routes).toContain(route);
    }

    expect(definition?.steps.at(-1)).toMatchObject({
      key: "complete",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.staff,
    });
  });

  it("couvre blessures, protocoles, forme, nutrition, kinés et staff", () => {
    const definition = getTutorialDefinition(MEDICAL_CENTER_TUTORIAL_KEY);
    const targetIds = new Set(
      definition?.steps.flatMap((step) =>
        step.targetId ? [step.targetId] : [],
      ),
    );

    for (const targetId of [
      "medical-center-overview",
      "medical-center-injuries",
      "medical-center-protocols",
      "medical-center-form",
      "medical-center-form-camps",
      "medical-center-nutrition",
      "medical-center-nutrition-options",
      "medical-center-physiotherapists",
      "medical-center-physiotherapist-assignments",
      "medical-center-staff",
    ]) {
      expect(targetIds).toContain(targetId);
    }
  });
});
