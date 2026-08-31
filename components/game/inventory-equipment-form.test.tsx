import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  formatRiderRatings,
  InventoryEquipmentForm,
} from "./inventory-equipment-form";

const riders = [
  {
    rider_id: "11111111-1111-4111-8111-111111111111",
    first_name: "Erik",
    last_name: "Van Dijk",
    mountain: 74,
    hills: 71,
    flat: 66,
    time_trial: 62,
    cobbles: 58,
    sprint: 49,
    currentEquipmentName: "Grip One",
  },
  {
    rider_id: "22222222-2222-4222-8222-222222222222",
    first_name: "Milan",
    last_name: "De Smet",
    mountain: 61,
    hills: 68,
    flat: 73,
    time_trial: 70,
    cobbles: 65,
    sprint: 75,
    currentEquipmentName: null,
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
    mountain: rider.mountain,
    hills: rider.hills,
    flat: rider.flat,
    time_trial: rider.time_trial,
    cobbles: rider.cobbles,
    sprint: rider.sprint,
    acceleration: 70,
    downhill: 70,
    endurance: 70,
    resistance: 70,
    recovery: 70,
    breakaway: 70,
    prologue: 70,
  },
  abilityCodes: index === 0 ? ["panache"] : [],
}));

describe("InventoryEquipmentForm", () => {
  it("affiche les notes et l’équipement actuel de chaque coureur", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        slot="gloves"
        availableQuantity={1}
        riders={riders}
      />,
    );

    expect(markup).toContain("Choisir dans l’effectif");
    expect(markup).toContain("Erik Van Dijk");
    expect(markup).toContain("MON 74 · VAL 71 · PLA 66");
    expect(markup).toContain("Emplacement occupé · Grip One");
    expect(markup).toContain("Emplacement disponible");
    expect(markup).toContain("Équiper ce matériel");
    expect(markup).toContain('name="origin" value="inventory"');
  });

  it("bloque l’attribution lorsque tous les exemplaires sont utilisés", () => {
    const markup = renderToStaticMarkup(
      <InventoryEquipmentForm
        equipmentItemId="33333333-3333-4333-8333-333333333333"
        slot="gloves"
        availableQuantity={0}
        riders={riders}
      />,
    );

    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain(
      "Tous les exemplaires sont déjà attribués à un coureur.",
    );
  });

  it("fournit un résumé de notes stable", () => {
    expect(formatRiderRatings(riders[1])).toBe(
      "MON 61 · VAL 68 · PLA 73 · CLM 70 · PAV 65 · SPR 75",
    );
  });
});
