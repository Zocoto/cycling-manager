import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FanClubManagementState } from "@/lib/game/fan-club-management";
import type { FanClubLiveData } from "@/lib/game/fan-club-pilot";

import { FanClub } from "./fan-club";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

const MANAGEMENT = {
  fleet: {},
  trips: [],
  inventory: [],
  recentSales: [],
} satisfies FanClubManagementState;

function renderFanClub(shopLevel = 1) {
  return renderToStaticMarkup(
    <FanClub
      headquartersLevel={1}
      shopLevel={shopLevel}
      data={LIVE_DATA}
      management={MANAGEMENT}
    />,
  );
}

describe("Fan Club de production", () => {
  it("affiche les espaces de gestion sans plafond ni tuile pédagogique", () => {
    const markup = renderFanClub();

    expect(markup).toContain("Vue d’ensemble");
    expect(markup).toContain("Popularité des coureurs");
    expect(markup).toContain("Déplacements");
    expect(markup).toContain("Magasin");
    expect(markup).not.toContain("Plafond");
    expect(markup).not.toContain("La popularité se construit dans le temps");
  });

  it("masque le magasin tant que la boutique n’est pas construite", () => {
    const markup = renderFanClub(0);

    expect(markup).not.toContain(">Magasin<");
    expect(markup).not.toContain("Ouvrir le magasin");
    expect(markup).toContain("Déplacements");
  });

  it("ne contient plus les commandes ou panneaux de simulation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/game/fan-club.tsx"),
      "utf8",
    );

    expect(source).not.toContain("Simuler");
    expect(source).not.toContain("Achat simulé");
    expect(source).not.toContain("Traçabilité");
    expect(source).not.toContain("Paliers proposés");
  });
});
