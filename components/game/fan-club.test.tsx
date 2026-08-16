import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FanClubManagementState } from "@/lib/game/fan-club-management";
import type { FanClubLiveData } from "@/lib/game/fan-club-pilot";
import { createTeamProfileTheme } from "@/lib/game/team-profile-theme";
import type { Sponsor } from "@/types/sponsor";

import {
  FanClub,
  StoreProductVisual,
  type FanClubSponsorIdentity,
} from "./fan-club";

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

const SPONSOR_JERSEY = {
  id: "sponsor-modern",
  name: "Modern",
  style: "modern",
  imagePath: "/images/sponsors/test/jersey-modern.png",
} as const;

const SPONSOR_IDENTITY = {
  sponsor: {
    id: "sponsor-test",
    name: "Maison Brune",
    shortName: "Brune",
    countryCode: "FR",
    sector: "Test",
    description: "Sponsor de test",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: { min: 1, max: 2 },
    contractDurationRange: { min: 1, max: 1 },
    logoPath: "/images/sponsors/test/logo.png",
    jerseys: [SPONSOR_JERSEY],
    colors: {
      primary: "#7A5137",
      secondary: "#A9825B",
      accent: "#D9C4A5",
      background: "#F3EBDD",
      text: "#3A2A20",
    },
  } satisfies Sponsor,
  selectedJersey: SPONSOR_JERSEY,
} satisfies FanClubSponsorIdentity;

function renderFanClub(
  shopLevel = 1,
  sponsorIdentity: FanClubSponsorIdentity | null = null,
) {
  return renderToStaticMarkup(
    <FanClub
      headquartersLevel={1}
      shopLevel={shopLevel}
      data={LIVE_DATA}
      management={MANAGEMENT}
      sponsorIdentity={sponsorIdentity}
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

  it("présente les articles comme des produits en vitrine", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/game/fan-club.tsx"),
      "utf8",
    );

    expect(source).toContain("En vitrine");
    expect(source).toContain("StoreProductVisual");
    expect(source).toContain('productId === "team-jersey"');
    expect(source).toContain('productId === "bottle"');
    expect(source).toContain('productId === "pennant"');
    expect(source).toContain('productId === "cap"');
    expect(source).toContain("Prix en boutique");
  });

  it("reprend le maillot et la palette du sponsor actif", () => {
    const markup = renderFanClub(1, SPONSOR_IDENTITY);
    const theme = createTeamProfileTheme(SPONSOR_IDENTITY.sponsor.colors);
    const jerseyMarkup = renderToStaticMarkup(
      <StoreProductVisual
        productId="team-jersey"
        sponsorIdentity={SPONSOR_IDENTITY}
      />,
    );

    expect(markup).toContain(`--fan-primary:${theme.primary}`);
    expect(markup).toContain(`--fan-accent:${theme.accent}`);
    expect(jerseyMarkup).toContain("Maillot Modern de Maison Brune");
    expect(jerseyMarkup).toContain("jersey-modern.png");
  });
});
