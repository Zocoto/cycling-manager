import { describe, expect, it } from "vitest";

import { getSponsorObjectiveStatusPresentation } from "./sponsor-objective-status";

describe("getSponsorObjectiveStatusPresentation", () => {
  it("affiche une coche pour un objectif atteint", () => {
    expect(getSponsorObjectiveStatusPresentation("completed")).toEqual({
      status: "achieved",
      label: "Objectif atteint",
    });
  });

  it("affiche une croix pour un objectif perdu", () => {
    expect(getSponsorObjectiveStatusPresentation("failed")).toEqual({
      status: "failed",
      label: "Objectif non atteint",
    });
  });

  it("affiche un sablier tant que l'objectif reste en cours", () => {
    expect(getSponsorObjectiveStatusPresentation("active")).toEqual({
      status: "in_progress",
      label: "Objectif en cours",
    });
  });

  it("présente un objectif annulé comme neutralisé et sans impact", () => {
    expect(getSponsorObjectiveStatusPresentation("cancelled")).toEqual({
      status: "neutralized",
      label: "Neutralisé — sans impact",
    });
  });
});
