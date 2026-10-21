import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FinancialDirectorEffect } from "@/services/team-finances";
import { FinancialDirectorImpact, FinancialDirectorSourceImpact, getFinancialDirectorTransactionLabel } from "./financial-director-impact";

const saving: FinancialDirectorEffect = {
  id: "df-saving", sourceTransactionId: "salary", dayNumber: 7,
  amount: 40, effect: "staff_salary", baseAmount: 1000, bonusPercentage: 4,
  status: "posted", description: "Économie salariale du DF",
};
const daily: FinancialDirectorEffect = {
  id: "df-daily", sourceTransactionId: null, dayNumber: 14,
  amount: 450, effect: "daily_income", baseAmount: null, bonusPercentage: null,
  status: "pending", description: "Revenu quotidien du DF",
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s/g, " ");

describe("FinancialDirectorImpact", () => {
  it("keeps gross expenses visible before a separate credit and indicative net", () => {
    const html = renderToStaticMarkup(<FinancialDirectorImpact effects={[saving, daily]} currency="EUR" />);
    const rendered = text(html);
    expect(rendered).toContain("Apport total de la saison+490 €");
    expect(rendered).toContain("Revenus quotidiens");
    expect(rendered).toContain("450 € / jour");
    expect(rendered).toContain("Économies sur charges");
    expect(rendered).toContain("Charges concernées avant DF−1 000 €");
    expect(rendered).toContain("Crédit d’économie DF+40 €");
    expect(rendered).toContain("Coût net indicatif960 €");
    expect(rendered.indexOf("Charges concernées avant DF")).toBeLessThan(rendered.indexOf("Crédit d’économie DF"));
    expect(rendered).toContain("Salaires du staff · 4 %");
    expect(rendered).toContain("Déjà comptabilisé+40 €");
    expect(rendered).toContain("Encore prévu+450 €");
    expect(rendered).toContain("inclus une seule fois");
    expect(rendered).not.toContain("1 040 €");
    expect(html).not.toMatch(/<script|<iframe/);
  });

  it("separates sponsor/race bonuses from daily income and salary savings", () => {
    const effects: FinancialDirectorEffect[] = [
      daily, saving,
      { ...saving, id: "sponsor-bonus", sourceTransactionId: "sponsor", effect: "main_sponsor", amount: 50, bonusPercentage: 5, status: "pending" },
      { ...saving, id: "race-bonus", sourceTransactionId: "race", effect: "race_prize", amount: 20, bonusPercentage: 2 },
    ];
    const rendered = text(renderToStaticMarkup(<FinancialDirectorImpact effects={effects} currency="EUR" />));
    expect(rendered).toContain("Bonus sur recettes");
    expect(rendered).toContain("Sponsor principal · 5 %");
    expect(rendered).toContain("Primes de course · 2 %");
    expect(rendered).toContain("Apport total de la saison+560 €");
    expect(rendered).toContain("Charges concernées avant DF−1 000 €");
  });

  it("preserves historical rates instead of announcing the current rate for every payment", () => {
    const rendered = text(renderToStaticMarkup(<FinancialDirectorImpact effects={[saving, { ...saving, id: "future-saving", sourceTransactionId: "future-salary", bonusPercentage: 6, amount: 60, status: "pending" }]} currency="EUR" />));
    expect(rendered).toContain("taux selon versement");
    expect(rendered).toContain("montants déjà comptabilisés conservent les bonus réellement accordés");
  });

  it("does not display an empty DF panel or invalid credit", () => {
    expect(renderToStaticMarkup(<FinancialDirectorImpact effects={[]} currency="EUR" />)).toBe("");
    expect(renderToStaticMarkup(<FinancialDirectorImpact effects={[{ ...saving, amount: 0 }, { ...saving, amount: Number.NaN }]} currency="EUR" />)).toBe("");
  });
});

describe("FinancialDirectorSourceImpact", () => {
  it("shows the percentage saving on a gross salary without replacing the original debit", () => {
    const rendered = text(renderToStaticMarkup(<FinancialDirectorSourceImpact effects={[saving]} baseAmount={-1000} currency="EUR" expense />));
    expect(rendered).toContain("DF · économie 4 % sur 1 000 €");
    expect(rendered).toContain("+40 €");
    expect(rendered).toContain("Coût net indicatif : 960 €");
    expect(rendered).toContain("Crédit affiché séparément dans les recettes");
    expect(rendered).not.toContain("1 040 €");
  });

  it("adds sponsor bonuses to the base receipt and retains cent precision", () => {
    const bonus: FinancialDirectorEffect = { ...saving, effect: "secondary_sponsor", amount: 20.12, baseAmount: 1006, bonusPercentage: 2, status: "pending" };
    const rendered = text(renderToStaticMarkup(<FinancialDirectorSourceImpact effects={[bonus]} baseAmount={1006} currency="EUR" expense={false} />));
    expect(rendered).toContain("DF · bonus 2 % sur 1 006 €");
    expect(rendered).toContain("+20,12 €");
    expect(rendered).toContain("Recette avec bonus DF : 1 026,12 €");
    expect(rendered).toContain("prévu");
  });

  it("hides an absent source annotation and provides clear receipt labels", () => {
    expect(renderToStaticMarkup(<FinancialDirectorSourceImpact effects={[]} baseAmount={-1000} currency="EUR" expense />)).toBe("");
    expect(getFinancialDirectorTransactionLabel(daily)).toBe("DF · revenu quotidien");
    expect(getFinancialDirectorTransactionLabel(saving)).toBe("DF · crédit d’économie");
    expect(getFinancialDirectorTransactionLabel({ ...saving, effect: "race_prize" })).toBe("DF · bonus sur recettes");
  });
});
