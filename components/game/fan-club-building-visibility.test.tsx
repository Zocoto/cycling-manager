import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FanClubLiveData } from "@/lib/game/fan-club-pilot";

import { FanClubPilot } from "./fan-club-pilot";

const LIVE_DATA = {
  teamName: "Équipe test",
  supporterCount: 250,
  supporterTrend: 0,
  fervor: 22,
  popularityIndex: 0,
  recentResultsMultiplier: 0.85,
  sportingResultCount: 0,
  riders: [],
  races: [],
  supporterBreakdown: {
    foundation: 250,
    reputation: 0,
    riders: 0,
    recentResults: 0,
    headquartersBonus: 0,
  },
} satisfies FanClubLiveData;

describe("visibilité des bâtiments du Fan Club", () => {
  it("masque le magasin tant que la boutique n’est pas construite", () => {
    const markup = renderToStaticMarkup(
      <FanClubPilot headquartersLevel={1} shopLevel={0} data={LIVE_DATA} />,
    );

    expect(markup).not.toContain(">Magasin<");
    expect(markup).not.toContain("Ouvrir le magasin");
    expect(markup).toContain("Déplacements");
  });

  it("affiche le magasin au niveau réel de la boutique", () => {
    const markup = renderToStaticMarkup(
      <FanClubPilot headquartersLevel={1} shopLevel={3} data={LIVE_DATA} />,
    );

    expect(markup).toContain("Magasin");
    expect(markup).toContain("Niv. 3");
    expect(markup).toContain("Boutique niveau 3");
  });
});
