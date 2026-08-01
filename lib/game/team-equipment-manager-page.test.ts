import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const materialPage = read("app/jeu/materiel/page.tsx");
const partnerPage = read("app/jeu/materiel/equipementier/page.tsx");
const managerPage = read("app/jeu/materiel/equiper/page.tsx");
const managerComponent = read("components/game/team-equipment-manager.tsx");
const equipmentActions = read("app/jeu/materiel/actions.ts");
const equipmentService = read("services/team-equipment.ts");

describe("gestion groupée des équipements", () => {
  it("rend la rubrique accessible depuis toutes les pages Matériel", () => {
    for (const page of [materialPage, partnerPage, managerPage]) {
      expect(page).toContain('href="/jeu/materiel/equiper"');
      expect(page).toContain("Équiper ses coureurs");
    }

    expect(managerPage).toContain('aria-current="page"');
  });

  it("charge l'effectif et conserve l'apparence du maillot de l'équipe", () => {
    expect(equipmentService).toContain('from("riders")');
    expect(equipmentService).toContain("avatar_profile_key");
    expect(equipmentService).toContain("riders: context.riders");
    expect(managerPage).toContain("createSponsoredRiderJersey");
    expect(managerPage).toContain("riders={overview.riders}");
  });

  it("propose une grille compacte, filtrable et adaptée au mobile", () => {
    expect(managerComponent).toContain('type StatusFilter = "all"');
    expect(managerComponent).toContain("setFocusedSlot");
    expect(managerComponent).toContain("max-h-[66vh]");
    expect(managerComponent).toContain("lg:hidden");
    expect(managerComponent).toContain("fixed inset-x-3 bottom-3");
  });

  it("revient sur le même coureur après attribution ou retrait", () => {
    expect(managerComponent).toContain('value="team-equipment"');
    expect(equipmentActions).toContain("buildTeamEquipmentPath");
    expect(equipmentActions).toContain('origin === "team-equipment"');
    expect(equipmentActions).toContain(
      'revalidatePath("/jeu/materiel/equiper")',
    );
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
