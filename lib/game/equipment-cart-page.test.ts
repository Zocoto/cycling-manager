import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = read("app/jeu/materiel/page.tsx");
const actions = read("app/jeu/materiel/actions.ts");
const shop = read("components/game/equipment-commercial-shop.tsx");

describe("equipment commercial cart page", () => {
  it("replaces immediate purchases with a persistent grouped cart", () => {
    expect(page).toContain("<EquipmentCommercialShop");
    expect(shop).toContain("Ajouter au panier");
    expect(shop).toContain("Régler le panier");
    expect(shop).toContain("window.localStorage");
    expect(shop).toContain("teamSeasonId");
  });

  it("checks out through one server action without redirecting the page", () => {
    expect(actions).toContain("purchaseEquipmentCartAction");
    expect(actions).toContain('"purchase_current_team_equipment_cart"');
    expect(actions).toContain('revalidatePath("/jeu/materiel")');

    const groupedAction = actions.slice(
      actions.indexOf("export async function purchaseEquipmentCartAction"),
      actions.indexOf("export async function saveTeamEquipmentAssignmentsAction"),
    );
    expect(groupedAction.match(/redirect\(/g)).toHaveLength(1);
    expect(groupedAction).toContain('redirect("/connexion")');
    expect(groupedAction).not.toContain("achat=confirme");
  });
});
