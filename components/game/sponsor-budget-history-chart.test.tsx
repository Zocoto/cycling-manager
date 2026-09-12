import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorBudgetHistoryChart } from "@/components/game/sponsor-budget-history-chart";

describe("SponsorBudgetHistoryChart", () => {
  it("affiche les logos comme marqueurs et expose le détail saisonnier au survol", () => {
    const markup = renderToStaticMarkup(
      <SponsorBudgetHistoryChart
        points={[
          {
            seasonId: "season-1",
            seasonName: "Saison 1",
            gameYear: 1,
            teamName: "Vélo Club Horizon",
            budgetPerSeason: 0,
            currencyCode: "EUR",
            logo: null,
          },
          {
            seasonId: "season-2",
            seasonName: "Saison 2",
            gameYear: 2,
            teamName: "Atlas Horizon",
            budgetPerSeason: 2_700_000,
            currencyCode: "EUR",
            logo: {
              sponsorName: "Atlas",
              logoPath: "/images/sponsors/atlas/logo.webp",
              primaryColor: "#123456",
              backgroundColor: "#FFFFFF",
              textColor: "#123456",
            },
          },
        ]}
      />,
    );

    expect(markup).toContain("Évolution des budgets sponsors");
    expect(markup).toContain("Identité amateur de Vélo Club Horizon");
    expect(markup).toContain("Logo de Atlas Horizon");
    expect(markup).toContain("2\u202f700\u202f000\u00a0€ / an");
    expect(markup).toContain("Saison 2");
    expect(markup).toContain("Atlas Horizon");
  });
});
