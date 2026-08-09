import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const dashboard = readFileSync(
  resolve(process.cwd(), "app/jeu/page.tsx"),
  "utf8",
);
const header = readFileSync(
  resolve(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);
const raceProfile = readFileSync(
  resolve(
    process.cwd(),
    "app/jeu/courses/[slug]/race-profile-content.tsx",
  ),
  "utf8",
);
const preparationPage = readFileSync(
  resolve(process.cwd(), "app/jeu/preparation-course/page.tsx"),
  "utf8",
);

describe("race preparation navigation", () => {
  it("sits between registrations and results on the sporting director desk", () => {
    const registrationIndex = dashboard.indexOf("Inscriptions & calendrier");
    const preparationIndex = dashboard.indexOf("Préparation de course");
    const resultsIndex = dashboard.indexOf("Résultats & Live");

    expect(registrationIndex).toBeGreaterThan(-1);
    expect(preparationIndex).toBeGreaterThan(registrationIndex);
    expect(resultsIndex).toBeGreaterThan(preparationIndex);
  });

  it("reste accessible depuis une course inscrite sans encombrer le header", () => {
    expect(header).not.toContain('href="/jeu/preparation-course"');
    expect(raceProfile).toContain(
      "`/jeu/preparation-course?course=${edition.slug}`",
    );
    expect(raceProfile).not.toContain("RaceStageRolePlanner");
  });

  it("loads lightweight calendar data and the preparation batch in parallel", () => {
    expect(preparationPage).toContain("includeEngagedRiders: false");
    expect(preparationPage).toContain("getCurrentTeamRacePreparation(supabase)");
    expect(preparationPage).toContain("Promise.all");
  });
});
