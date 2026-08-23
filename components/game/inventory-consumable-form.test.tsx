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
].map((rider, index) => ({
  ...rider,
  id: rider.rider_id,
  firstName: rider.first_name,
  lastName: rider.last_name,
  name: `${rider.first_name} ${rider.last_name}`,
  countryName: index === 0 ? "Pays-Bas" : "Belgique",
  form: index === 0 ? 82 : 74,
  experienceDays: index === 0 ? 137 : 64,
  potentialSteps: index === 0 ? 7 : 5,
  ratings: {
    mountain: 74,
    hills: 71,
    flat: 66,
    time_trial: 62,
    cobbles: 58,
    sprint: 49,
    acceleration: index === 0 ? 77 : 68,
    downhill: 70,
    endurance: 73,
    resistance: 69,
    recovery: 68,
    breakaway: 72,
    prologue: 61,
  },
  abilityCodes: index === 0 ? ["panache"] : [],
}));

describe("InventoryConsumableForm", () => {
  it("permet de choisir le bénéficiaire et annonce le caractère permanent", () => {
    const markup = renderToStaticMarkup(
      <InventoryConsumableForm
        inventoryItemId="33333333-3333-4333-8333-333333333333"
        category="rating_boost"
        availableQuantity={1}
        effectPayload={{ ratingKey: "acceleration" }}
        riders={riders}
      />
    );

    expect(markup).toContain("Coureur bénéficiaire");
    expect(markup).toContain("Erik Van Dijk");
    expect(markup).toContain("Milan De Smet");
    expect(markup).toContain("ACC 77/100");
    expect(markup).toContain("Utiliser sur ce coureur");
    expect(markup).toContain("Quantité à utiliser");
    expect(markup).toContain('name="quantity"');
    expect(markup).toContain('max="1"');
    expect(markup).toContain("l’effet sera cumulé");
    expect(markup).toContain("pendant toute sa carrière");
    expect(markup).not.toMatch(/<select[^>]*\sdisabled=""/);
  });

  it("bloque l’utilisation sans exemplaire disponible", () => {
    const markup = renderToStaticMarkup(
      <InventoryConsumableForm
        inventoryItemId="33333333-3333-4333-8333-333333333333"
        category="special_ability"
        availableQuantity={0}
        effectPayload={{ abilityCode: "panache" }}
        effectSummary="Débloque Panache."
        riders={riders}
      />
    );

    expect(markup).toMatch(/<select[^>]*\sdisabled=""/);
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain("D\u00e9j\u00e0 acquise");
    expect(markup).toContain("Non acquise");
    expect(markup).toContain("Capacité attribuée · Panache");
    expect(markup).toContain("Augmente fortement les chances");
    expect(markup).toContain("contre-attaques audacieuses");
    expect(markup).not.toContain("Débloque Panache.");
    expect(markup).toContain('name="quantity" value="1"');
  });
});
