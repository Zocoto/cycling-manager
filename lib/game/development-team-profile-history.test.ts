import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const profileService = readFileSync(
  join(process.cwd(), "services/public-rider-profile.ts"),
  "utf8",
);
const professionalRiderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("Historique Development Team après promotion", () => {
  it("rattache le junior promu à ses saisons de Development Team", () => {
    expect(profileService).toContain('.eq("promoted_rider_id", riderId)');
    expect(profileService).toContain('from("development_team_roster")');
    expect(profileService).toContain('from("development_race_results")');
    expect(profileService).toContain('careerLevel: "junior" as const');
    expect(profileService).toContain("juniorPodiums");
  });

  it("distingue clairement les années juniors dans la fiche pro", () => {
    expect(professionalRiderPage).toContain("Année junior");
    expect(professionalRiderPage).toContain("entry.juniorRaceCount");
    expect(professionalRiderPage).toContain("entry.juniorPodiums");
    expect(professionalRiderPage).toContain(
      "`${entry.careerLevel}-${entry.seasonId}-${entry.teamId}`",
    );
  });
});
