import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const riderPage = readFileSync(
  resolve(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("special abilities tile", () => {
  it("répartit les quatorze médaillons sur une grille responsive", () => {
    expect(riderPage).toContain(
      "grid grid-cols-5 justify-items-center gap-2 sm:grid-cols-7 sm:gap-3",
    );
    expect(riderPage).toContain(
      'aria-label="Catalogue des 14 capacités spéciales"',
    );
    expect(riderPage).toContain("SPECIAL_ABILITY_CATALOG.map");
  });
});
