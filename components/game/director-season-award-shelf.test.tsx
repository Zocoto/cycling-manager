import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorSeasonAwardShelf } from "./director-season-award-shelf";

describe("DirectorSeasonAwardShelf", () => {
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
