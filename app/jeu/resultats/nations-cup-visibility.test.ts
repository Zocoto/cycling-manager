import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const resultsPage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("visibilité des résultats de la Nations Cup", () => {
  it("charge toutes les manches division/groupe et les transmet à l’annuaire", () => {
    expect(resultsPage).toContain("includeNationsCupHeats: true");
    expect(resultsPage).toContain(
      'edition.competitionType === "nations_cup"',
    );
  });
});
