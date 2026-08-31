import { describe, expect, it } from "vitest";

import { getContextualTutorialKey } from "@/lib/tutorial/contextual-route";

describe("getContextualTutorialKey", () => {
  it.each([
    ["/jeu", "onboarding-core"],
    ["/jeu/sponsoring", "sponsoring"],
    ["/jeu/effectif", "roster-management"],
    ["/jeu/coureurs/123", "roster-management"],
    ["/jeu/entrainement", "training"],
    ["/jeu/materiel/equiper", "equipment"],
    ["/jeu/centre-de-formation", "youth-development"],
    ["/jeu/calendrier", "criterium-discovery"],
  ])("associe %s au guide %s", (pathname, expectedTutorialKey) => {
    expect(getContextualTutorialKey(pathname)).toBe(expectedTutorialKey);
  });

  it("laisse la bibliothèque complète répondre sur une rubrique sans guide", () => {
    expect(getContextualTutorialKey("/jeu/objectifs")).toBeNull();
  });
});
