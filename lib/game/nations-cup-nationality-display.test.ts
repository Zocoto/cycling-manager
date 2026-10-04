import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raceProfile = readFileSync(
  join(process.cwd(), "app/jeu/courses/[slug]/race-profile-content.tsx"),
  "utf8",
);

describe("Nations Cup national teams", () => {
  it("uses the federation selection model for the Nations Cup startlist", () => {
    expect(raceProfile).toContain("isFederationSelectionEdition");
    expect(raceProfile).toContain(
      "const isFederationSelection = isFederationSelectionEdition(edition)",
    );
    expect(raceProfile).toContain(
      "engagedRiders = isFederationSelection",
    );
    expect(raceProfile).toContain(
      "if (isFederationSelectionEdition(edition))",
    );
  });

  it("routes Nations Cup teams to their nation and not to a club", () => {
    expect(raceProfile).toContain(
      "isFederationSelection\n                      ? `/jeu/nations/${team.teamCountryCode.toLowerCase()}`",
    );
    expect(raceProfile).toContain('"Retour à la Nations Cup"');
  });
});
