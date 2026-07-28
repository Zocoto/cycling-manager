import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import {
  TRANSFER_DAILY_TUTORIAL_ROUTE,
  TRANSFER_DIRECTORS_TUTORIAL_ROUTE,
  TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
  TRANSFER_TUTORIAL_KEY,
} from "@/lib/tutorial/transfers";

describe("transfer tutorial", () => {
  it("est enregistré comme parcours contextuel rejouable", () => {
    expect(getTutorialDefinition(TRANSFER_TUTORIAL_KEY)).toMatchObject({
      key: TRANSFER_TUTORIAL_KEY,
      type: "contextual",
      autoStart: false,
      replayable: true,
    });
  });

  it("parcourt successivement les trois sous-rubriques", () => {
    const definition = getTutorialDefinition(TRANSFER_TUTORIAL_KEY);
    const routes = definition?.steps.map((step) => step.route);

    expect(routes).toContain(TRANSFER_DAILY_TUTORIAL_ROUTE);
    expect(routes).toContain(TRANSFER_DIRECTORS_TUTORIAL_ROUTE);
    expect(routes).toContain(TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE);
    expect(definition?.steps.at(-1)?.key).toBe("complete");
  });

  it("explique chaque opération sans imposer de mutation au DS", () => {
    const definition = getTutorialDefinition(TRANSFER_TUTORIAL_KEY);
    const stepKeys = new Set(definition?.steps.map((step) => step.key));

    for (const stepKey of [
      "daily-bidding",
      "director-selling",
      "director-market",
      "free-agent-filters",
      "free-agent-signing",
    ]) {
      expect(stepKeys).toContain(stepKey);
    }

    expect(
      definition?.steps.every((step) => !step.allowTargetInteraction),
    ).toBe(true);
  });

  it("annonce explicitement la validation dans le Centre des didacticiels", () => {
    const completionStep = getTutorialDefinition(
      TRANSFER_TUTORIAL_KEY,
    )?.steps.at(-1);

    expect(completionStep?.content).toContain("Cliquez sur « Terminer »");
    expect(completionStep?.content).toContain("Centre des didacticiels");
  });
});
