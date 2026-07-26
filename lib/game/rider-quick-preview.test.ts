import { describe, expect, it } from "vitest";

import { getRiderIdFromProfileHref } from "./rider-quick-preview";

describe("getRiderIdFromProfileHref", () => {
  it("reconnaît une fiche coureur avec ou sans paramètres", () => {
    expect(getRiderIdFromProfileHref("/jeu/coureurs/rider-1")).toBe("rider-1");
    expect(
      getRiderIdFromProfileHref("/jeu/coureurs/rider-1?onglet=resultats")
    ).toBe("rider-1");
  });

  it("ignore les autres destinations", () => {
    expect(getRiderIdFromProfileHref("/jeu/equipes/team-1")).toBeNull();
    expect(getRiderIdFromProfileHref("/jeu/coureurs")).toBeNull();
  });
});
