import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NutritionInterventionsEditor, NutritionWeightProgramFields } from "./nutrition-interventions-editor";

vi.mock("@/app/jeu/centre-de-soin/actions", () => ({ applyNutritionPlanAction: vi.fn() }));

function render(percentage: number | undefined, form = 80, underweight = false, cooldownDays = 0) {
  return renderToStaticMarkup(<NutritionInterventionsEditor riderIds={["one"]} nutritionists={[]}
    weightRiders={[{ riderId: "one", heightCm: 180, weightKg: 72, form, cooldownDays }]}
    weightProgramFormPreservationPercentage={percentage} balance={1000} currency="EUR">
    <NutritionWeightProgramFields riderId="one" isUnderweight={underweight} />
  </NutritionInterventionsEditor>);
}

describe("weight-program nutritionist preview", () => {
  it("shows the effective best bonus and reduced costs, without submitting a client-side discount", () => {
    const markup = render(25);
    expect(markup).toContain("Préservation de la forme : −25 %");
    expect(markup).toContain("Seul le meilleur affixe s’applique");
    expect(markup).toContain("−3 forme par 0,2 kg");
    expect(markup).toContain("1,0 kg · −15 forme");
    expect(markup).not.toContain('name="formPreservationPercentage"');
    expect(markup).not.toContain('name="weightProgramFormPreservationPercentage"');
  });

  it.each([false, true])("enables exactly affordable fractional programmes in both directions (%s)", underweight => {
    const markup = render(5, 3.8, underweight);
    expect(markup).toContain("−3,8 forme par 0,2 kg");
    const discountedOption = markup.match(/<option value="0\.2"[^>]*>[^<]*<\/option>/)?.[0];
    expect(discountedOption).toContain("0,2 kg · −3,8 forme");
    expect(discountedOption).not.toContain("disabled");
    expect(render(undefined, 3.8, underweight).match(/<option value="0\.2"[^>]*>/)?.[0]).toContain("disabled");
  });

  it("keeps the baseline and five-day cooldown when no talent applies", () => {
    const markup = render(undefined);
    expect(markup).toContain("−4 forme par 0,2 kg");
    expect(markup).toContain("1,0 kg · −20 forme");
    expect(markup).not.toContain("Préservation de la forme :");
    const waiting = render(25, 80, false, 3);
    expect(waiting).toContain("Prochain programme dans 3 j.");
    expect(waiting).not.toContain('aria-label="Programme de poids"');
  });
});
