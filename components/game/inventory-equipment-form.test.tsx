import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InventoryEquipmentForm } from "./inventory-equipment-form";

const riders = [
  {
    rider_id: "11111111-1111-4111-8111-111111111111",
    first_name: "Erik",
    last_name: "Van Dijk",
  },
  {
    rider_id: "22222222-2222-4222-8222-222222222222",
    first_name: "Milan",
    last_name: "De Smet",
  },
];

describe("InventoryEquipmentForm", () => {
  it("propose les coureurs de l’équipe pour un exemplaire disponible", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        slot="gloves"
        availableQuantity={1}
        riders={riders}
      />
    );

    expect(markup).toContain("Coureur à équiper");
    expect(markup).toContain("Erik Van Dijk");
    expect(markup).toContain("Milan De Smet");
    expect(markup).toContain("Équiper ce matériel");
    expect(markup).not.toMatch(/<select[^>]*\sdisabled=""/);
  });

  it("bloque l’attribution lorsque tous les exemplaires sont utilisés", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        slot="gloves"
        availableQuantity={0}
        riders={riders}
      />
    );

    expect(markup).toMatch(/<select[^>]*\sdisabled=""/);
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain(
      "Tous les exemplaires sont déjà attribués à un coureur."
    );
  });
});
