import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CareerPalmaresCard } from "@/components/game/career-palmares-card";
import { buildCareerPalmares } from "@/lib/game/career-palmares";

describe("CareerPalmaresCard", () => {
  it("affiche les victoires d’étape et les maillots par course et saison", () => {
    const common = {
      raceKey: "tour-de-france",
      raceName: "Tour de France",
      seasonName: "Saison 1",
      prestigeRank: 1,
      categoryCode: "elite" as const,
      competitionType: "standard" as const,
      isGrandTour: true,
      isMonument: false,
      isJunior: false,
    };
    const palmares = buildCareerPalmares([], {
      stageVictories: [
        {
          ...common,
          resultId: "stage-1",
          seasonId: "season-1",
          gameYear: 1,
        },
        {
          ...common,
          resultId: "stage-2",
          seasonId: "season-1",
          gameYear: 1,
        },
        {
          ...common,
          resultId: "stage-3",
          seasonId: "season-2",
          seasonName: "Saison 2",
          gameYear: 2,
        },
      ],
      distinctiveJerseys: [
        {
          ...common,
          resultId: "jersey-1",
          seasonId: "season-2",
          seasonName: "Saison 2",
          gameYear: 2,
          classificationType: "mountain",
        },
      ],
    });

    const markup = renderToStaticMarkup(
      <CareerPalmaresCard palmares={palmares} />,
    );

    expect(markup).toContain("Grands Tours &amp; Monuments");
    expect(markup).toContain("Tour de France");
    expect(markup).toContain("3 × Tour de France");
    expect(markup).toContain("Victoires d’étape · S1, S2");
    expect(markup).toContain("Maillot");
    expect(markup).toContain("Vainqueur final du maillot de la montagne");
    expect(markup).not.toContain("Maillots distinctifs</h3>");
  });
});
