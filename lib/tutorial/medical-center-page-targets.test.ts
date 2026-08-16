import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const medicalCenterPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-soin/page.tsx"),
  "utf8",
);
const tutorialCenter = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
  "utf8",
);
const rewardMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728163000_merge_medical_center_tutorial.sql",
  ),
  "utf8",
);

describe("medical center tutorial page targets", () => {
  it("propose le lancement contextuel et la reprise sur chaque onglet", () => {
    expect(medicalCenterPage).toContain(
      "tutorialKey={MEDICAL_CENTER_TUTORIAL_KEY}",
    );
    expect(medicalCenterPage).toContain("<TutorialRouteResume");
    expect(medicalCenterPage).toContain("HEALTH_TUTORIAL_ROUTES[activeTab]");
  });

  it("expose toutes les sections demandées au parcours", () => {
    for (const targetId of [
      "medical-center-overview",
      "medical-center-injuries",
      "medical-center-protocols",
      "medical-center-form",
      "medical-center-form-camps",
      "medical-center-nutrition",
      "medical-center-nutrition-options",
      "medical-center-physiotherapists",
      "medical-center-physiotherapist-assignments",
      "medical-center-staff",
    ]) {
      expect(medicalCenterPage).toContain(
        `data-tutorial-id="${targetId}"`,
      );
    }
  });

  it("montre les protocoles, la nutrition et les menus kiné même à vide", () => {
    expect(medicalCenterPage).toContain(
      "<MedicalProtocolCatalog overview={overview} />",
    );
    expect(medicalCenterPage).toContain(
      "Aperçu avec un nutritionniste de niveau 1",
    );
    expect(medicalCenterPage).toContain(
      "<PhysiotherapistAssignmentPreview riders={overview.riders} />",
    );
    expect(medicalCenterPage).toContain("Aperçu d’une fiche kiné");
  });

  it("inclut les kinés dans le résumé de l’équipe médicale", () => {
    expect(medicalCenterPage).toContain(
      '(member) => member.role === "physiotherapist"',
    );
    expect(medicalCenterPage).toContain("Gérer les affectations →");
  });

  it("ajoute le parcours au Centre des didacticiels", () => {
    expect(tutorialCenter).toContain("MEDICAL_CENTER_TUTORIAL_KEY");
    expect(tutorialCenter).toContain(
      'title={medicalCenterCopy?.title ?? "Maîtriser le centre de soins"}',
    );
  });

  it("fusionne le prérequis Nutrition dans le parcours médical global", () => {
    expect(rewardMigration).toContain(
      "where tutorial_key = 'medical-center'",
    );
    expect(rewardMigration).toContain("where tutorial_key = 'nutrition'");
    expect(rewardMigration).toContain("is_active = false");
  });
});
