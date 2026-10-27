import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceExpenseAnalysisPanel } from "@/components/game/finance-expense-analysis";

describe("FinanceExpenseAnalysisPanel", () => {
  it("rend un camembert accessible et distingue les charges payées de celles à payer", () => {
    const markup = renderToStaticMarkup(
      <FinanceExpenseAnalysisPanel
        currency="EUR"
        seasonName="Saison 2"
        analysis={{
          totalAmount: 100_000,
          postedAmount: 70_000,
          pendingAmount: 30_000,
          salaryAmount: 70_000,
          salaryPercentage: 70,
          breakdown: [
            {
              key: "rider_salaries",
              label: "Salaires coureurs",
              description: "Rémunérations",
              color: "#176951",
              amount: 70_000,
              postedAmount: 40_000,
              pendingAmount: 30_000,
              percentage: 70,
              transactionCount: 4,
            },
            {
              key: "equipment",
              label: "Matériel et R&D",
              description: "Équipement",
              color: "#2E6F9E",
              amount: 30_000,
              postedAmount: 30_000,
              pendingAmount: 0,
              percentage: 30,
              transactionCount: 1,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain("Répartition de");
    expect(markup).toContain("Salaires coureurs");
    expect(markup).toContain("Matériel et R&amp;D");
    expect(markup).toContain("À payer");
    const text = markup.replace(/<[^>]+>/g, "").replace(/\s/g, " ");
    expect(text).toContain("Charges brutes de la saison100 000 €");
    expect(text).toContain("Total payé + à payer · Saison 2");
    expect(text).toContain("Déjà payé70 000 €");
    expect(text).toContain("À payer30 000 €");
    expect(text).toContain("Les charges payées sont déjà déduites du solde actuel");
    expect(text).toContain("des crédits séparés dans les recettes");
    expect(text).toContain("elles ne diminuent pas les dépenses brutes affichées");
    expect(markup).not.toContain("Prévu");
  });
});
