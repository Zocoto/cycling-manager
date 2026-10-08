import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { NutritionInterventionsEditor, NutritionInterventionFields, NutritionWeightProgramFields } from "./nutrition-interventions-editor";

vi.mock("@/app/jeu/centre-de-soin/actions", () => ({ applyNutritionPlanAction: vi.fn() }));

function renderNutritionWithWeightCuts() {
  return renderToStaticMarkup(
    <NutritionInterventionsEditor
      riderIds={["rider-one", "rider-two"]}
      nutritionists={[{ contractId: "nutritionist", name: "Camille", level: 3, remainingCapacity: 2 }]}
      balance={50_000}
      currency="EUR"
    >
      {["rider-one", "rider-two"].map((riderId) => (
        <article key={riderId}>
          <NutritionInterventionFields riderId={riderId} riderForm={80} riderWeightKg={65} recentInterventionCount={0} currency="EUR" />
          <form action="/isolated-weight-cut" data-testid={`weight-cut-${riderId}`}>
            <input type="hidden" name="riderId" value={riderId} />
            <select name="weightLossKg" defaultValue="0.2"><option value="0.2">−0,2 kg · −4 forme</option></select>
            <button type="submit">Lancer</button>
          </form>
        </article>
      ))}
    </NutritionInterventionsEditor>,
  );
}

describe("nutrition form boundaries", () => {
  it("uses one atomic form and closed optional panels, even after supplement capacity is exhausted", () => {
    const markup = renderToStaticMarkup(<NutritionInterventionsEditor riderIds={["one"]} nutritionists={[]}
      weightRiders={[{riderId: "one", heightCm: 180, weightKg: 68, form: 80, cooldownDays: 0}]}
      balance={10000} currency="EUR">
      <NutritionWeightProgramFields riderId="one" isUnderweight />
    </NutritionInterventionsEditor>);
    expect([...markup.matchAll(/<form\b/g)]).toHaveLength(1);
    expect(markup).toContain('name="weightPrograms"');
    expect(markup).toContain('name="interventions"');
    expect(markup).toContain("Athlétisation · renforcer");
    expect(markup).toContain("Affûtage · alléger");
    expect(markup).toContain("· optionnel");
    expect(markup).toContain("Sous-poids");
    expect(markup.match(/<details[^>]*>/)?.[0]).not.toContain("open");
    expect(markup).not.toContain('name="weightLossKg"');
  });
  it("never nests independent weight-cut forms inside the bulk supplement form", () => {
    const markup = renderNutritionWithWeightCuts();
    let depth = 0;
    let maximumDepth = 0;
    for (const tag of markup.matchAll(/<\/?form\b[^>]*>/g)) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      maximumDepth = Math.max(maximumDepth, depth);
    }
    expect(maximumDepth).toBe(1);
    expect(depth).toBe(0);
    expect([...markup.matchAll(/<form\b/g)]).toHaveLength(3);
  });

  it("keeps the batch payload and expense guard separate from each rider's weight-cut payload", () => {
    const forms = [...renderNutritionWithWeightCuts().matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]);
    const bulk = forms.find(form => form.includes('name="interventions"'));
    expect(bulk).toContain('data-financial-label="ces interventions nutritionnelles"');
    expect(bulk).not.toContain('name="weightLossKg"');
    expect(bulk).not.toContain('name="riderId"');
    for (const riderId of ["rider-one", "rider-two"]) {
      const weightCut = forms.find(form => form.includes(`data-testid="weight-cut-${riderId}"`));
      expect(weightCut).toContain(`name="riderId" value="${riderId}"`);
      expect(weightCut).toContain('name="weightLossKg"');
      expect(weightCut).not.toContain('name="interventions"');
    }
  });
});
