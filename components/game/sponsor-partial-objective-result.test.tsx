import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SponsorPartialObjectiveResult } from "./sponsor-partial-objective-result";

describe("partial sponsor objective rendering", () => {
  it("explains stage wins and a jersey, even without a classified GC result", () => {
    const html = renderToStaticMarkup(createElement(SponsorPartialObjectiveResult, {
      level: "partial", points: 8, weight: 20,
      achievements: [{ code: "stage_win", rank: 1, count: 2 }, { code: "mountain_classification", rank: 1, count: 1 }],
    }));
    expect(html).toContain("+8 points sur les 20 prévus");
    expect(html).toContain("2 victoires d’étape · 1er du classement de la montagne");
    expect(html).toContain("L’objectif principal n’est pas rempli");
    expect(html).toContain("seul le meilleur résultat secondaire est crédité");
  });
  it("keeps existing partial credit readable without achievement metadata", () => {
    expect(renderToStaticMarkup(createElement(SponsorPartialObjectiveResult, { level: "partial", points: 1, weight: 3 })))
      .toContain("+1 point sur les 3 prévus");
  });
  it.each(["full", "missed", null] as const)("does not show a bonus for %s", (level) => {
    expect(renderToStaticMarkup(createElement(SponsorPartialObjectiveResult, { level, points: 8, weight: 20 })))
      .toBe("");
  });
});
