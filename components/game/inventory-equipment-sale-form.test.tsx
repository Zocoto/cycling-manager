import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InventoryEquipmentSaleForm } from "./inventory-equipment-sale-form";

describe("InventoryEquipmentSaleForm", () => {
  it("affiche la valeur de reprise et confirme la vente d’un exemplaire", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentSaleForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        itemName="Aero 50"
        resalePrice={5900}
        availableQuantity={2}
        currency="EUR"
        returnPath="/jeu/inventaire?categorie=equipment"
      />,
    );

    expect(markup).toContain("Revendre ce matériel");
    expect(markup).toContain("5 900");
    expect(markup).toContain("Confirmer la revente");
    expect(markup).toContain('name="equipmentItemId"');
  });

  it("bloque la revente lorsqu’aucun exemplaire n’est libre", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentSaleForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        itemName="Aero 50"
        resalePrice={5900}
        availableQuantity={0}
        currency="EUR"
        returnPath="/jeu/inventaire?categorie=equipment"
      />,
    );

    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain("Déséquipez d’abord un exemplaire");
  });
});
