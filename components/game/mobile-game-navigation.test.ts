import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/mobile-game-navigation.tsx"),
  "utf8",
);

describe("mobile game navigation", () => {
  it("offre quatre destinations majeures accessibles au pouce", () => {
    for (const href of [
      '"/jeu"',
      '"/jeu/effectif"',
      '"/jeu/calendrier"',
      '"/jeu/transferts"',
    ]) {
      expect(source).toContain(href);
    }

    expect(source).toContain("grid-cols-5");
    expect(source).toContain("sm:hidden");
  });

  it("regroupe toutes les autres rubriques dans une vue d’ensemble", () => {
    expect(source).toContain("NAVIGATION_GROUPS_FR");
    expect(source).toContain("Toutes les rubriques");
    expect(source).toContain("max-h-[min(72dvh,42rem)]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
  });
});
