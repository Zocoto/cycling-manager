import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FanClubPilot } from "./fan-club-pilot";

describe("FanClubPilot", () => {
  it("se limite aux quatre espaces de gestion retenus", () => {
    const markup = renderToStaticMarkup(<FanClubPilot />);

    expect(markup).toContain("Vue d’ensemble");
    expect(markup).toContain("Popularité des coureurs");
    expect(markup).toContain("Déplacements");
    expect(markup).toContain("Magasin");
    expect(markup).not.toContain(">Communauté<");
  });

  it("explique immédiatement la progression lente de la popularité", () => {
    const markup = renderToStaticMarkup(<FanClubPilot />);

    expect(markup).toContain("Après 1 saison");
    expect(markup).toContain("60 max.");
    expect(markup).toContain("Après 3 saisons");
    expect(markup).toContain("saison phénoménale");
  });
});
