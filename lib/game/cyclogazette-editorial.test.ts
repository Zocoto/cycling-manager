import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const editorialService = readFileSync(
  join(root, "services/cyclogazette-editorial.ts"),
  "utf8",
);
const publicationService = readFileSync(
  join(root, "services/cyclogazette.ts"),
  "utf8",
);
const publicNewsService = readFileSync(
  join(root, "services/public-game-news.ts"),
  "utf8",
);

describe("bouclage éditorial de La Cyclogazette", () => {
  it("fabrique les dossiers au bouclage puis les archive dans l’édition", () => {
    expect(publicationService).toContain(
      "loadCyclogazetteFeatureStories(admin, {",
    );
    expect(publicationService).toContain("featureStories,");
    expect(editorialService).toContain("Promise.allSettled([");
  });

  it("couvre rivalités, start-lists, DevTeams, rumeurs et convalescences", () => {
    expect(editorialService).toContain('.from("team_rivalry_events")');
    expect(editorialService).toContain('.from("race_registrations")');
    expect(editorialService).toContain('.from("development_race_results")');
    expect(editorialService).toContain('.from("direct_transfer_offers")');
    expect(editorialService).toContain('.from("rider_injuries")');
  });

  it("réserve le chargement du prestige étendu au bouclage quotidien", () => {
    expect(publicNewsService).toContain(
      "loadRecentVictories(admin, 12, true)",
    );
    expect(publicNewsService).toContain("includePrestige = false");
  });
});
