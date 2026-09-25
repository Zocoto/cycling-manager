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

    expect(markup).toContain("Victoires d’étapes");
    expect(markup).toContain("Tour de France");
    expect(markup).toContain("3 victoires d’étape");
    expect(markup).toContain("(S1, S2)");
    expect(markup).toContain("Maillots distinctifs");
    expect(markup).toContain("1 maillot de la montagne");
  });
});
