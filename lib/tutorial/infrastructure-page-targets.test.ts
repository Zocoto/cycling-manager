import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const infrastructurePage = readFileSync(
  join(process.cwd(), "app/jeu/infrastructures/page.tsx"),
  "utf8",
);

const materialPage = readFileSync(
  join(process.cwd(), "app/jeu/materiel/page.tsx"),
  "utf8",
);

const tutorialCenter = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
  "utf8",
);

describe("infrastructure tutorial integration", () => {
  it("expose les cibles des bâtiments et des écoles", () => {
    for (const targetId of [
      "infrastructure-overview",
      "infrastructure-construction-status",
      "infrastructure-tabs",
      "infrastructure-data-room",
      "infrastructure-staff-academy",
      "infrastructure-school-effect",
      "infrastructure-school-map",
    ]) {
      expect(infrastructurePage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });
  it("affiche les bâtiments de performance et du Fan Club", () => {
    expect(infrastructurePage).toContain(
      "getTeamInfrastructureCodesByStartingCost",
    );
    expect(infrastructurePage).toContain(
      'data-building-order="starting-cost-ascending"',
    );
    expect(infrastructurePage).toContain("<InfrastructureBuildingCard");
    expect(infrastructurePage).toContain("<DataRoomConstructionCard");
    expect(infrastructurePage).toContain("<StaffAcademyCard");
    expect(infrastructurePage).toContain(
      "Construisez d’abord le siège social du Fan Club.",
    );
  });

  it("propose le point d’interrogation et reprend le parcours en cours", () => {
    expect(infrastructurePage).toContain(
      "tutorialKey={INFRASTRUCTURE_TUTORIAL_KEY}",
    );
    expect(infrastructurePage).toContain("<TutorialRouteResume");
    expect(infrastructurePage).toContain("currentInfrastructureTutorialRoute");
  });

  it("ajoute le parcours au Centre des didacticiels", () => {
    expect(tutorialCenter).toContain("INFRASTRUCTURE_TUTORIAL_KEY");
    expect(tutorialCenter).toContain("Développer ses infrastructures");
    expect(tutorialCenter).toContain("infrastructurePresentation.statusLabel");
  });

  it("conserve un accès contextuel au didacticiel Équipements", () => {
    expect(materialPage).toContain("tutorialKey={EQUIPMENT_TUTORIAL_KEY}");
    expect(materialPage).toContain("iconOnly");
    expect(tutorialCenter).toContain("EQUIPMENT_TUTORIAL_KEY");
    expect(tutorialCenter).toContain("Maîtriser le matériel");
  });
});
