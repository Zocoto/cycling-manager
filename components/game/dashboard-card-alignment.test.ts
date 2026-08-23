import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dashboardPage = readFileSync(
  join(process.cwd(), "app/jeu/page.tsx"),
  "utf8",
);

describe("alignement des cartes principales du bureau", () => {
  it("étire la carte Effectif jusqu’au bas de la carte du DS sur desktop", () => {
    expect(dashboardPage).toContain(
      'className="grid gap-4 sm:gap-6 xl:h-full xl:grid-rows-[auto_1fr]"',
    );
    expect(dashboardPage).toContain(
      "group relative isolate flex h-full flex-col",
    );
    expect(dashboardPage).not.toContain(
      'className="grid content-start gap-6"',
    );
  });

  it("affiche deux rangees de cinq mini-avatars sans deborder sur mobile", () => {
    expect(dashboardPage).toContain(".slice(0, 11)");
    expect(dashboardPage).toContain("riders.slice(1, 6)");
    expect(dashboardPage).toContain("riders.slice(6, 11)");
    expect(dashboardPage).toContain(
      'className="h-8 w-8 border-2 border-[#9BE0BC]/40 shadow-lg sm:h-12 sm:w-12"',
    );
    expect(dashboardPage).toContain(
      'className="flex items-center justify-center gap-1.5 sm:gap-3"',
    );
  });

  it("explicite la boutique dans la rubrique Fanclub", () => {
    expect(dashboardPage).toContain('title="Fanclub / Boutique"');
    expect(dashboardPage).not.toContain('title="Fan Club"');
  });
});
