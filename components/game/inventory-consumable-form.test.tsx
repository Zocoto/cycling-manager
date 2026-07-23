import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InventoryConsumableForm } from "./inventory-consumable-form";

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

describe("InventoryConsumableForm", () => {
  it("permet de choisir le bénéficiaire et annonce le caractère permanent", () => {
    const markup = renderToStaticMarkup(
      <InventoryConsumableForm
        inventoryItemId="33333333-3333-4333-8333-333333333333"
        category="rating_boost"
        availableQuantity={1}
        riders={riders}
      />
    );

    expect(markup).toContain("Coureur bénéficiaire");
    expect(markup).toContain("Erik Van Dijk");
    expect(markup).toContain("Milan De Smet");
    expect(markup).toContain("Utiliser sur ce coureur");
    expect(markup).toContain("pendant toute sa carrière");
    expect(markup).not.toMatch(/<select[^>]*\sdisabled=""/);
  });

  it("bloque l’utilisation sans exemplaire disponible", () => {
    const markup = renderToStaticMarkup(
      <InventoryConsumableForm
        inventoryItemId="33333333-3333-4333-8333-333333333333"
        category="special_ability"
        availableQuantity={0}
        riders={riders}
      />
    );

    expect(markup).toMatch(/<select[^>]*\sdisabled=""/);
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
  });
});
