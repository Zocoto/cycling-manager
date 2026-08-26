import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rosterPage = readFileSync(
  join(process.cwd(), "app/jeu/effectif/page.tsx"),
  "utf8",
);

const riderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("roster tutorial page targets", () => {
  it("expose la route concrète du premier coureur depuis l’effectif", () => {
    expect(rosterPage).toContain(
      'data-tutorial-id="roster-rating-table"',
    );
    expect(rosterPage).toContain("data-tutorial-route=");
  });

  it("expose des repères compacts pour le didacticiel mobile", () => {
    for (const targetId of [
      "roster-mobile-overview",
      "roster-primary-ratings",
      "roster-secondary-ratings",
      "roster-mobile-list",
    ]) {
      expect(rosterPage).toContain(targetId);
    }
  });

  it("ne conserve pas le texte d’aide redondant sous l’effectif", () => {
    expect(rosterPage).not.toContain(
      "Cliquez sur un coureur pour ouvrir sa fiche détaillée",
    );
  });

  it("expose chaque rubrique guidée de la fiche coureur", () => {
    for (const targetId of [
      "rider-profile-overview",
      "rider-profile-stats",
      "rider-profile-naturalization",
      "rider-profile-form",
      "rider-profile-abilities",
      "rider-profile-planning",
      "rider-profile-contract",
      "rider-profile-history",
      "rider-profile-equipment",
    ]) {
      expect(
        riderPage.includes(`data-tutorial-id="${targetId}"`) ||
          riderPage.includes(`tutorialId="${targetId}"`),
      ).toBe(true);
    }
  });

  it("propose un lancement contextuel sur les deux pages", () => {
    expect(rosterPage).toContain(
      "tutorialKey={ROSTER_TUTORIAL_KEY}",
    );
    expect(riderPage).toContain(
      "tutorialKey={ROSTER_TUTORIAL_KEY}",
    );
  });
});
