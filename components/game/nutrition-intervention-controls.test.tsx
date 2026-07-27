import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NutritionInterventionControls,
  getCompatibleNutritionInterventionCode,
} from "./nutrition-intervention-controls";

describe("NutritionInterventionControls", () => {
  it("propose tous les nutritionnistes disponibles au lieu d’imposer le premier", () => {
    const markup = renderToStaticMarkup(
      <form>
        <NutritionInterventionControls
          nutritionists={[
            {
              contractId: "nutritionist-level-5",
              name: "Camille Martin",
              level: 5,
              remainingCapacity: 2,
            },
            {
              contractId: "nutritionist-level-2",
              name: "Alex Bernard",
              level: 2,
              remainingCapacity: 1,
            },
          ]}
          riderForm={82}
          balance={50_000}
          currency="EUR"
        />
      </form>,
    );

    expect(markup).toContain('name="nutritionistContractId"');
    expect(markup).toContain('value="nutritionist-level-5"');
    expect(markup).toContain('value="nutritionist-level-2"');
    expect(markup).toContain("Camille Martin");
    expect(markup).toContain("Alex Bernard");
  });

  it("désactive visuellement un nutritionniste dont la capacité est épuisée", () => {
    const markup = renderToStaticMarkup(
      <form>
        <NutritionInterventionControls
          nutritionists={[
            {
              contractId: "nutritionist-full",
              name: "Spécialiste complet",
              level: 4,
              remainingCapacity: 0,
            },
            {
              contractId: "nutritionist-free",
              name: "Spécialiste disponible",
              level: 3,
              remainingCapacity: 1,
            },
          ]}
          riderForm={75}
          balance={50_000}
          currency="EUR"
        />
      </form>,
    );

    expect(markup).toContain(
      '<option value="nutritionist-full" disabled="">Spécialiste complet',
    );
    expect(markup).toContain("Spécialiste disponible");
  });

  it("revient sur un complément compatible quand le spécialiste choisi est moins expérimenté", () => {
    expect(
      getCompatibleNutritionInterventionCode("elite_recharge", 2),
    ).toBe("recovery_snack");
    expect(
      getCompatibleNutritionInterventionCode("tailored_plan", 3),
    ).toBe("tailored_plan");
  });
});
