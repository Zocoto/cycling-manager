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
      'className="grid gap-6 xl:h-full xl:grid-rows-[auto_1fr]"',
    );
    expect(dashboardPage).toContain(
      "group relative isolate flex h-full flex-col",
    );
    expect(dashboardPage).not.toContain(
      'className="grid content-start gap-6"',
    );
  });
});
