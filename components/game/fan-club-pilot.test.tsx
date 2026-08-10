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

function renderPilot() {
  return renderToStaticMarkup(
    <FanClubPilot headquartersLevel={1} shopLevel={1} data={LIVE_DATA} />,
  );
}

describe("FanClubPilot", () => {
  it("se limite aux quatre espaces de gestion retenus", () => {
    const markup = renderPilot();

    expect(markup).toContain("Vue d’ensemble");
    expect(markup).toContain("Popularité des coureurs");
    expect(markup).toContain("Déplacements");
    expect(markup).toContain("Magasin");
    expect(markup).not.toContain(">Communauté<");
  });

  it("explique immédiatement la progression lente de la popularité", () => {
    const markup = renderPilot();

    expect(markup).toContain("Après 1 saison");
    expect(markup).toContain("60 max.");
    expect(markup).toContain("Après 3 saisons");
    expect(markup).toContain("saison phénoménale");
  });
});
