import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamSeasonResultsPopover } from "./team-season-results-popover";

describe("TeamSeasonResultsPopover", () => {
  it("remplace la liste permanente par un bouton compact", () => {
    const markup = renderToStaticMarkup(
      <TeamSeasonResultsPopover
        victoryCount={5}
        items={[
          {
            id: "result-1",
            href: "/jeu/resultats/classique-des-ardennes",
            raceName: "Classique des Ardennes",
            resultLabel: "1re place",
            riderName: "Samir Hidayat",
          },
          {
            id: "result-2",
            href: "/jeu/resultats/tour-du-nord/3",
            raceName: "Tour du Nord",
            resultLabel: "1re place · Étape 3",
            riderName: "Luc Bernard",
          },
        ]}
      />
    );

    expect(markup).toContain("Résultats de la saison");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain(">2</span>");
    expect(markup).not.toContain("Classique des Ardennes");
  });
});
