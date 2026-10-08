import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InventoryEquipmentSaleForm } from "./inventory-equipment-sale-form";

describe("InventoryEquipmentSaleForm", () => {
  it("affiche la valeur de reprise et demande une vérification avant confirmation", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentSaleForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        itemName="Aero 50"
        resalePrice={5900}
        availableQuantity={2}
        currency="EUR"
        returnPath="/jeu/inventaire?categorie=equipment"
        saleId="44444444-4444-4444-8444-444444444444"
      />,
    );

    expect(markup).toContain("Revendre ce matériel");
    expect(markup).toContain("5 900");
    expect(markup).toContain("Vérifier la revente");
    expect(markup).not.toContain("Confirmer la revente");
    expect(markup).toContain('name="equipmentSales"');
    expect(markup).toContain('name="saleId"');
    expect(markup).toContain('max="2"');
  });

  it("permet la revente d’un exemplaire équipé sans stock libre", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentSaleForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        itemName="Aero 50"
        resalePrice={5900}
        availableQuantity={0}
        quantity={1}
        equipped={[{ riderId: "55555555-5555-4555-8555-555555555555", slot: "front_wheel" }]}
        currency="EUR"
        returnPath="/jeu/inventaire?categorie=equipment"
        saleId="44444444-4444-4444-8444-444444444444"
      />,
    );

    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain("retiré automatiquement");
    expect(markup).toContain("55555555-5555-4555-8555-555555555555");
  });
});
