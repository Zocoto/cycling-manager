import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const profileService = readFileSync(
  join(process.cwd(), "services/public-rider-profile.ts"),
  "utf8",
);
const developmentHistoryService = readFileSync(
  join(process.cwd(), "services/rider-development-history.ts"),
  "utf8",
);
const archivedProfileService = readFileSync(
  join(process.cwd(), "services/archived-rider-profile.ts"),
  "utf8",
);
const professionalRiderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("Historique Development Team après promotion", () => {
  it("rattache le junior promu à ses saisons de Development Team", () => {
    expect(profileService).toContain("getRiderDevelopmentHistory");
    expect(developmentHistoryService).toContain(
      '.eq("promoted_rider_id", riderId)',
    );
    expect(developmentHistoryService).toContain(
      'from("rider_development_team_history")',
    );
    expect(developmentHistoryService).toContain(
      'from("development_race_results")',
    );
    expect(developmentHistoryService).toContain(
      "buildJuniorDevelopmentCareerHistory",
    );
    expect(developmentHistoryService).toContain(
      'careerLevel: "junior" as const',
    );
    expect(developmentHistoryService).toContain("juniorPodiums");
  });

  it("conserve aussi ce parcours sur les fiches des coureurs archivés", () => {
    expect(archivedProfileService).toContain("getRiderDevelopmentHistory");
    expect(archivedProfileService).toContain("...juniorHistory");
  });

  it("distingue clairement les années juniors dans la fiche pro", () => {
    expect(professionalRiderPage).toContain("Année junior");
    expect(professionalRiderPage).toContain("entry.juniorRaceCount");
    expect(professionalRiderPage).toContain("entry.juniorPodiums");
    expect(professionalRiderPage).toContain(
      "`${entry.careerLevel}-${entry.seasonId}`",
    );
  });
});
