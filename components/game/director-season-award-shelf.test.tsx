import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorSeasonAwardShelf } from "./director-season-award-shelf";

describe("DirectorSeasonAwardShelf", () => {
  it("fusionne les médailles répétées et conserve le détail de toutes les saisons", () => {
    const markup = renderToStaticMarkup(<DirectorSeasonAwardShelf awards={
      [3, 1, 2, 10].map((season) => ({
        id: `builder-${season}`, key: "builder", title: "Le Bâtisseur",
        description: "Investissements", seasonName: `Saison ${season}`,
        gameYear: season, statValue: season * 100, statLabel: "€ investis",
      }))
    } />);
    expect(markup.match(/data-season-award-medal="builder"/g)).toHaveLength(1);
    expect(markup).toContain("1 médaille");
    expect(markup).toContain("(S1/2/3/10)");
    for (const season of [1, 2, 3, 10]) {
      expect(markup).toContain(`Saison ${season}`);
    }
    expect(markup).toContain("100 € investis");
    expect(markup).toContain("300 € investis");
  });

  it("n’affiche rien en l’absence de médailles", () => {
    expect(renderToStaticMarkup(<DirectorSeasonAwardShelf awards={[]} />)).toBe("");
  });

  it("affiche des médailles identifiées par saison et trie la plus récente en premier", () => {
    const markup = renderToStaticMarkup(
      <DirectorSeasonAwardShelf
        awards={[
          {
            id: "old-builder",
            key: "builder",
            title: "Le Bâtisseur",
            description: "Ancienne saison",
            seasonName: "Saison 2",
            gameYear: 2,
            statValue: 500_000,
            statLabel: "€ investis",
          },
          {
            id: "new-negotiator",
            key: "negotiator",
            title: "Le Négociateur",
            description: "Nouvelle saison",
            seasonName: "Saison 3",
            gameYear: 3,
            statValue: 12,
            statLabel: "offres envoyées",
          },
        ]}
      />,
    );

    expect(markup).toContain("Awards du DS");
    expect(markup).toContain("S3");
    expect(markup).toContain("S2");
    expect(markup).toContain('data-season-award-medal="negotiator"');
    expect(markup.indexOf("S3")).toBeLessThan(markup.indexOf("S2"));
  });
});
