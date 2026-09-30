import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InventoryItemIllustration } from "@/components/game/inventory-item-illustration";

describe("InventoryItemIllustration", () => {
  it("dessine chaque consommable en SVG natif sans image externe", () => {
    const markup = renderToStaticMarkup(
      <InventoryItemIllustration
        name="Loupe du recruteur"
        iconKey="scouting-clarity"
        effectKind="scouting_visibility"
      />,
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain('data-inventory-illustration="scouting"');
    expect(markup).toContain("Illustration de Loupe du recruteur");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("data:image");
  });

  it("conserve une illustration dédiée pour les grandes familles d’objets", () => {
    const medical = renderToStaticMarkup(
      <InventoryItemIllustration
        name="Trousse de récupération"
        iconKey="medical"
        category="injury_care"
      />,
    );
    const architect = renderToStaticMarkup(
      <InventoryItemIllustration
        name="Équerre de chantier"
        iconKey="architect"
        effectKind="construction_time_reduction"
      />,
    );

    expect(medical).toContain('data-inventory-illustration="medical"');
    expect(architect).toContain('data-inventory-illustration="architect"');
  });
});
