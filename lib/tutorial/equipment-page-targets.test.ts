import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const materialPage = readFileSync(
  join(process.cwd(), "app/jeu/materiel/page.tsx"),
  "utf8",
);
const partnerPage = readFileSync(
  join(process.cwd(), "app/jeu/materiel/equipementier/page.tsx"),
  "utf8",
);
const inventoryPage = readFileSync(
  join(process.cwd(), "app/jeu/inventaire/page.tsx"),
  "utf8",
);
const tutorialCenter = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
  "utf8",
);
const tutorialActions = readFileSync(
  join(process.cwd(), "app/jeu/tutorial-actions.ts"),
  "utf8",
);

describe("equipment tutorial integration", () => {
  it("expose les cibles du commerce", () => {
    for (const targetId of [
      "equipment-commercial-overview",
      "equipment-commercial-brands",
      "equipment-commercial-filters",
      "equipment-commercial-products",
    ]) {
      expect(materialPage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("expose les cibles de l’équipementier", () => {
    for (const targetId of [
      "equipment-partner-overview",
      "equipment-partner-rules",
      "equipment-partner-workflow",
    ]) {
      expect(partnerPage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("expose l’inventaire et le cadeau interactif", () => {
    expect(inventoryPage).toContain(
      'data-tutorial-id="equipment-inventory-overview"',
    );
    expect(inventoryPage).toContain(
      'data-tutorial-id="equipment-inventory-categories"',
    );
    expect(inventoryPage).toContain('"equipment-welcome-gift"');
    expect(inventoryPage).toContain("EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY");
  });

  it("propose le même point d’interrogation et la reprise sur les trois pages", () => {
    for (const page of [materialPage, partnerPage, inventoryPage]) {
      expect(page).toContain("tutorialKey={EQUIPMENT_TUTORIAL_KEY}");
      expect(page).toContain("<TutorialRouteResume");
    }
  });

  it("ajoute le parcours au centre et accorde le cadeau au démarrage", () => {
    expect(tutorialCenter).toContain("EQUIPMENT_TUTORIAL_KEY");
    expect(tutorialCenter).toContain("Maîtriser le matériel");
    expect(tutorialCenter).toContain("equipmentPresentation.statusLabel");
    expect(tutorialActions).toContain(
      "definition.key === EQUIPMENT_TUTORIAL_KEY",
    );
    expect(tutorialActions).toContain(
      '"grant_equipment_tutorial_welcome_gift"',
    );
  });
});
