import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
  EQUIPMENT_TUTORIAL_GLASSES_NAME,
  EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
  EQUIPMENT_TUTORIAL_KEY,
  EQUIPMENT_TUTORIAL_PARTNER_ROUTE,
} from "@/lib/tutorial/equipment";

describe("equipment tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(EQUIPMENT_TUTORIAL_KEY)).toMatchObject({
      key: EQUIPMENT_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("parcourt le commerce, l’équipementier et l’inventaire", () => {
    const definition = getTutorialDefinition(EQUIPMENT_TUTORIAL_KEY);
    const routes = definition?.steps.map((step) => step.route);

    expect(routes).toContain(EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE);
    expect(routes).toContain(EQUIPMENT_TUTORIAL_PARTNER_ROUTE);
    expect(routes).toContain(EQUIPMENT_TUTORIAL_INVENTORY_ROUTE);
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });

  it("présente les filtres, les gains et toutes les règles de gestion", () => {
    const definition = getTutorialDefinition(EQUIPMENT_TUTORIAL_KEY);
    const stepKeys = new Set(definition?.steps.map((step) => step.key));

    for (const stepKey of [
      "equipment-commercial-filters",
      "equipment-commercial-products",
      "equipment-partner-rules",
      "equipment-partner-workflow",
      "equipment-inventory-categories",
      "equipment-unequip",
    ]) {
      expect(stepKeys).toContain(stepKey);
    }
  });

  it("présente l’équipementier comme un déblocage de fin de partie", () => {
    const partnerSteps = getTutorialDefinition(EQUIPMENT_TUTORIAL_KEY)?.steps
      .filter((step) => step.route === EQUIPMENT_TUTORIAL_PARTNER_ROUTE)
      .map((step) => step.content)
      .join(" ");

    expect(partnerSteps).toContain("200 points de réputation");
    expect(partnerSteps).not.toContain("50 points de réputation");
  });

  it("rend le cadeau interactif et annonce STA +1 sans doublon au replay", () => {
    const giftStep = getTutorialDefinition(EQUIPMENT_TUTORIAL_KEY)?.steps.find(
      (step) => step.key === "equipment-welcome-gift",
    );

    expect(giftStep?.allowTargetInteraction).toBe(true);
    expect(giftStep?.content).toContain(EQUIPMENT_TUTORIAL_GLASSES_NAME);
    expect(giftStep?.content).toContain("une seule fois");

    const inventoryStep = getTutorialDefinition(
      EQUIPMENT_TUTORIAL_KEY,
    )?.steps.find((step) => step.key === "equipment-inventory-overview");
    expect(inventoryStep?.content).toContain("+1 en STA");
  });

  it("annonce la validation dans le Centre des didacticiels", () => {
    const completionStep = getTutorialDefinition(
      EQUIPMENT_TUTORIAL_KEY,
    )?.steps.at(-1);

    expect(completionStep?.content).toContain("Cliquez sur « Terminer »");
    expect(completionStep?.content).toContain("Centre des didacticiels");
  });
});
