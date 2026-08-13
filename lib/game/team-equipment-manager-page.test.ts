import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const materialPage = read("app/jeu/materiel/page.tsx");
const partnerPage = read("app/jeu/materiel/equipementier/page.tsx");
const managerPage = read("app/jeu/materiel/equiper/page.tsx");
const managerComponent = read(
  "components/game/team-equipment-bulk-editor.tsx",
);
const desktopTable = read(
  "components/game/team-equipment-desktop-table.tsx",
);
const equipmentActions = read("app/jeu/materiel/actions.ts");
const equipmentService = read("services/team-equipment.ts");

describe("gestion groupée des équipements", () => {
  it("rend la rubrique accessible depuis toutes les pages Matériel", () => {
    for (const page of [materialPage, partnerPage, managerPage]) {
      expect(page).toContain('href="/jeu/materiel/equiper"');
      expect(page).toContain("Équiper l’équipe");
    }

    expect(managerPage).toContain('aria-current="page"');
  });

  it("charge l'effectif et conserve l'apparence du maillot de l'équipe", () => {
    expect(equipmentService).toContain('from("riders")');
    expect(equipmentService).toContain("avatar_profile_key");
    expect(managerPage).toContain("createSponsoredRiderJersey");
    expect(managerPage).toContain("riders={overview.riders}");
  });

  it("propose une grille compacte, filtrable et adaptée au mobile", () => {
    expect(managerComponent).toContain('type StatusFilter = "all"');
    expect(managerComponent).toContain("space-y-3 lg:hidden");
    expect(managerComponent).toContain("TeamEquipmentDesktopTable");
    expect(desktopTable).toContain("<table");
    expect(desktopTable).toContain("sticky left-0");
    expect(desktopTable).toContain("hidden overflow-hidden");
    expect(managerComponent).toContain("fixed inset-x-3");
    expect(managerComponent).toContain("setStatusFilter");
  });

  it("affiche la dotation partenaire virtuelle sans la bloquer comme un stock", () => {
    expect(managerComponent).toContain(
      "item.isUnlimited || item.ownedQuantity > 0",
    );
    expect(managerComponent).toContain("!item.isUnlimited");
    expect(managerComponent).toContain('return "dotation illimitée"');
    expect(equipmentService).toContain("partnerAvailableItemIds.has(row.id)");
    expect(equipmentService).toContain("ownedQuantity =");
  });

  it("enregistre toutes les affectations puis revient sur la vue groupée", () => {
    expect(managerPage).toContain("TeamEquipmentBulkEditor");
    expect(equipmentActions).toContain(
      'revalidatePath("/jeu/materiel/equiper")',
    );
    expect(equipmentActions).toContain("saveTeamEquipmentAssignmentsAction");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
