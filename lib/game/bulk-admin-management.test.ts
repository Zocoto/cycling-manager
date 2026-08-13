import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildInitialEquipmentValues,
  getSelectableEquipmentItemsForSlot,
} from "@/components/game/team-equipment-bulk-editor";
import { canReserveNutritionistForDraft } from "@/components/game/nutrition-interventions-editor";
import type { TeamEquipmentCatalogItem } from "@/services/team-equipment";
import { describe, expect, it } from "vitest";

const nutritionMigration = read(
  "supabase/migrations/20260808161000_bulk_nutrition_and_lower_prices.sql",
);
const equipmentMigration = read(
  "supabase/migrations/20260808162000_bulk_equipment_assignments.sql",
);
const nutritionEditor = read(
  "components/game/nutrition-interventions-editor.tsx",
);
const equipmentEditor = read(
  "components/game/team-equipment-bulk-editor.tsx",
);
const equipmentAction = read("app/jeu/materiel/actions.ts");
const materialPage = read("app/jeu/materiel/page.tsx");
const partnerPage = read("app/jeu/materiel/equipementier/page.tsx");
const teamEquipmentPage = read("app/jeu/materiel/equiper/page.tsx");

describe("administration groupée de la nutrition", () => {
  it("réduit les trois prix serveur et conserve les remises existantes", () => {
    expect(nutritionMigration).toContain("v_base_price := 500;");
    expect(nutritionMigration).toContain("v_base_price := 1200;");
    expect(nutritionMigration).toContain("v_base_price := 2500;");
    expect(nutritionMigration).toContain("pg_get_functiondef");
  });

  it("applique un lot atomique avec au plus une ligne par coureur", () => {
    expect(nutritionMigration).toContain(
      "apply_current_team_nutrition_interventions",
    );
    expect(nutritionMigration).toContain(
      "public.apply_current_team_nutrition_intervention(",
    );
    expect(nutritionMigration).toContain(
      "Un coureur ne peut recevoir qu’un complément par jour.",
    );
  });

  it("affiche les réglages par coureur et une validation flottante", () => {
    expect(nutritionEditor).toContain("Aucun complément");
    expect(nutritionEditor).toContain("Nutritionniste");
    expect(nutritionEditor).toContain("fixed inset-x-3 bottom-");
    expect(nutritionEditor).toContain("Valider les compléments");
  });

  it("réserve immédiatement le contingent pendant la saisie groupée", () => {
    const nutritionist = {
      contractId: "nutritionist-1",
      name: "Camille Martin",
      level: 3,
      remainingCapacity: 2,
    };

    expect(
      canReserveNutritionistForDraft({
        nutritionist,
        interventionCode: "recovery_snack",
        usage: 1,
        currentNutritionistContractId: null,
        hasCurrentIntervention: false,
      }),
    ).toBe(true);
    expect(
      canReserveNutritionistForDraft({
        nutritionist,
        interventionCode: "recovery_snack",
        usage: 2,
        currentNutritionistContractId: null,
        hasCurrentIntervention: false,
      }),
    ).toBe(false);
    expect(
      canReserveNutritionistForDraft({
        nutritionist,
        interventionCode: "tailored_plan",
        usage: 2,
        currentNutritionistContractId: nutritionist.contractId,
        hasCurrentIntervention: true,
      }),
    ).toBe(true);
  });
});

describe("administration groupée du matériel", () => {
  it("rend le nouvel onglet accessible depuis toute la rubrique", () => {
    for (const page of [materialPage, partnerPage, teamEquipmentPage]) {
      expect(page).toContain('href="/jeu/materiel/equiper"');
      expect(page).toContain("Équiper l’équipe");
    }
  });

  it("prépare les huit emplacements et donne priorité au changement programmé", () => {
    const values = buildInitialEquipmentValues({
      riders: [
        {
          id: "rider-1",
          firstName: "Lina",
          lastName: "Martin",
          avatarProfileKey: null,
          avatarSeed: null,
        },
      ],
      assignments: [
        {
          riderId: "rider-1",
          slot: "helmet",
          equipmentItemId: "helmet-current",
        },
      ],
      pendingAssignments: [
        {
          riderId: "rider-1",
          slot: "helmet",
          equipmentItemId: "helmet-pending",
          effectiveAt: "2026-08-08T14:00:00Z",
        },
      ],
    });

    expect(values["rider-1:helmet"]).toBe("helmet-pending");
    expect(values["rider-1:frame"]).toBe("");
    expect(Object.keys(values)).toHaveLength(8);
  });

  it("ne propose que le materiel compatible avec chaque emplacement", () => {
    const partnerFrame = {
      id: "partner-frame",
      name: "Cadre partenaire",
      slot: "frame",
      price: 0,
      ownedQuantity: 0,
      isUnlimited: true,
    } as TeamEquipmentCatalogItem;
    const partnerWheel = {
      id: "partner-front-wheel",
      name: "Roue partenaire",
      slot: "front_wheel",
      price: 0,
      ownedQuantity: 0,
      isUnlimited: true,
    } as TeamEquipmentCatalogItem;
    const catalog = [partnerFrame, partnerWheel];

    expect(
      getSelectableEquipmentItemsForSlot(catalog, "frame").map(
        (item) => item.id,
      ),
    ).toEqual([partnerFrame.id]);
    expect(
      getSelectableEquipmentItemsForSlot(catalog, "front_wheel").map(
        (item) => item.id,
      ),
    ).toEqual([partnerWheel.id]);
  });

  it("valide le stock et applique tout le lot dans une transaction", () => {
    expect(equipmentAction).toContain(
      "saveTeamEquipmentAssignmentsAction",
    );
    expect(equipmentMigration).toContain(
      "save_current_team_equipment_assignments",
    );
    expect(
      equipmentMigration.indexOf("public.unequip_current_team_rider"),
    ).toBeLessThan(
      equipmentMigration.lastIndexOf("public.equip_current_team_rider"),
    );
    expect(equipmentMigration).toContain(
      "Un emplacement ne peut être modifié qu’une seule fois.",
    );
  });

  it("propose une ligne par coureur et une seule barre de validation", () => {
    expect(equipmentEditor).toContain("SLOT_ORDER.map");
    expect(equipmentEditor).toContain("visibleRiders.map");
    expect(equipmentEditor).toContain("stock projeté");
    expect(equipmentEditor).toContain("fixed inset-x-3 bottom-");
    expect(equipmentEditor).toContain("Valider les affectations");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
