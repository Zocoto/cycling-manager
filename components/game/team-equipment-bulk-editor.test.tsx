import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS } from "@/lib/game/equipment";
import { PARTNER_BULK_EQUIPMENT_SLOTS } from "@/lib/game/partner-equipment-bulk";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { TeamEquipmentCatalogItem } from "@/services/team-equipment";
import { TeamEquipmentBulkEditor } from "./team-equipment-bulk-editor";

vi.mock("@/app/jeu/materiel/actions", () => ({
  saveTeamEquipmentAssignmentsAction: async () => undefined,
}));

const catalog: TeamEquipmentCatalogItem[] = PARTNER_BULK_EQUIPMENT_SLOTS.map((slot) => ({
  id: `partner-${slot}`, catalogKey: `partner-${slot}`, name: `Dotation ${slot}`,
  slot, supplierKey: "partner", supplierName: "Équipementier test",
  supplierLogoPath: "/test-logo.png", supplierPrimaryColor: "#176951",
  supplierSecondaryColor: "#FFFFFF", supplierPositioning: "", description: "",
  price: 0, resalePrice: 0, rarity: "common", imagePath: "/test-item.png",
  effectSummary: "Bonus du contrat", effects: EMPTY_EQUIPMENT_EFFECTS,
  ownedQuantity: 0, channel: "equipment_partner", equippedQuantity: 0,
  pendingQuantity: 0, availableQuantity: 1, isUnlimited: true,
}));
const rider = { id: "rider", firstName: "Lina", lastName: "Test", avatarProfileKey: null, avatarSeed: 1, age: 25 };

function render(overrides: Partial<Parameters<typeof TeamEquipmentBulkEditor>[0]> = {}) {
  return renderToStaticMarkup(<TeamEquipmentBulkEditor
    riders={[rider]} catalog={catalog} assignments={[]} pendingAssignments={[]}
    canSwapWheelSlots={false} jersey={FREE_AGENT_RIDER_JERSEY} {...overrides}
  />);
}

describe("raccourci compact d’équipementier", () => {
  it("affiche les trois choix cumulables avant le tableau des coureurs", () => {
    const html = render();
    expect(html).toContain("Équiper le matériel de l’équipementier en masse");
    const checkboxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/g)].map(([input]) => input);
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((input) => /\schecked=/.test(input))).toBe(true);
    expect(html).toContain("Roue avant");
    expect(html).toContain("Roue arrière");
    expect(html).toContain("Cadre");
    expect(html.indexOf("partner-bulk-help")).toBeLessThan(html.indexOf("Tableau d’affectation"));
    expect(html).toContain('type="button"');
    expect(html).toContain("Préparer 3 attributions");
    expect(html).toContain("uniquement les emplacements vides");
  });

  it("ne soumet rien tant que le DS n’a pas préparé puis validé", () => {
    const html = render();
    expect(html).toContain('name="assignments" value="[]"');
    expect(html).not.toContain("Valider les affectations");
  });

  it("masque le raccourci en l’absence de dotation disponible", () => {
    const html = render({ catalog: catalog.map((item) => ({ ...item, isUnlimited: false })) });
    expect(html).not.toContain("partner-bulk-help");
    expect(html).toContain("Tableau d’affectation");
  });

  it("désactive une catégorie sans produit et ne la présélectionne pas", () => {
    const html = render({ catalog: catalog.filter((item) => item.slot === "frame") });
    const checkboxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/g)].map(([input]) => input);
    expect(checkboxes.filter((input) => /\sdisabled=/.test(input))).toHaveLength(2);
    expect(checkboxes.filter((input) => /\schecked=/.test(input))).toHaveLength(1);
    expect(html).toContain("Préparer 1 attribution");
  });

  it("compte seulement les emplacements réellement vides, hors changements programmés", () => {
    const html = render({
      assignments: [{ riderId: rider.id, slot: "frame", equipmentItemId: catalog[2].id }],
      pendingAssignments: [{ riderId: rider.id, slot: "front_wheel", equipmentItemId: catalog[0].id, effectiveAt: "2026-10-11T06:00:00Z" }],
    });
    expect(html).toContain("Préparer 1 attribution");
    expect(html).toContain("Le matériel équipé ou programmé est conservé");
  });

  it("désactive le raccourci quand aucun emplacement choisi n’est vide", () => {
    const html = render({ assignments: catalog.map((item) => ({ riderId: rider.id, slot: item.slot, equipmentItemId: item.id })) });
    const button = html.match(/<button\b[^>]*>Préparer 0 attribution<\/button>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toMatch(/\sdisabled=/);
  });
});
