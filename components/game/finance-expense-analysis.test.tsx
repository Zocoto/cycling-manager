import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceExpenseAnalysisPanel } from "@/components/game/finance-expense-analysis";

describe("FinanceExpenseAnalysisPanel", () => {
  it("rend un camembert accessible et le détail payé/prévu", () => {
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
    expect(markup).toContain("Prévu");
  });
});
