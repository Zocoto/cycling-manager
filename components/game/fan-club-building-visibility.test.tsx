import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FanClubPilot } from "./fan-club-pilot";

describe("visibilité des bâtiments du Fan Club", () => {
  it("masque le magasin tant que la boutique n’est pas construite", () => {
    const markup = renderToStaticMarkup(
      <FanClubPilot headquartersLevel={1} shopLevel={0} />,
    );

    expect(markup).not.toContain(">Magasin<");
    expect(markup).not.toContain("Ouvrir le magasin");
    expect(markup).toContain("Déplacements");
  });

  it("affiche le magasin au niveau réel de la boutique", () => {
    const markup = renderToStaticMarkup(
      <FanClubPilot headquartersLevel={1} shopLevel={3} />,
    );

    expect(markup).toContain("Magasin");
    expect(markup).toContain("Niv. 3");
    expect(markup).toContain("Boutique niveau 3");
  });
});
