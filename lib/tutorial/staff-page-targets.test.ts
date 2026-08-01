import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const staffPage = readFileSync(
  join(process.cwd(), "app/jeu/staff/page.tsx"),
  "utf8",
);

const tutorialCenter = readFileSync(
  join(
    process.cwd(),
    "components/tutorial/tutorial-center-menu.tsx",
  ),
  "utf8",
);

describe("staff tutorial integration", () => {
  it("expose toutes les cibles de la rubrique Staff", () => {
    for (const targetId of [
      "staff-overview",
      "staff-capacity",
      "staff-tabs",
      "staff-market-overview",
      "staff-market-filters",
      "staff-market-listings",
      "staff-team-overview",
    ]) {
      expect(staffPage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("propose le point d'interrogation et reprend les deux onglets", () => {
    expect(staffPage).toContain(
      "tutorialKey={STAFF_TUTORIAL_KEY}",
    );
    expect(staffPage).toContain(
      "isStaffTutorialRoute(staffTutorialProgress.current_route)",
    );
    expect(staffPage).not.toContain("StaffTutorialTabSync");
  });

  it("ajoute le parcours au centre des didacticiels", () => {
    expect(tutorialCenter).toContain("STAFF_TUTORIAL_KEY");
    expect(tutorialCenter).toContain("Constituer son staff");
  });
});
