import { readFileSync, writeFileSync } from "node:fs";
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
  fervor: 22,
  teamReach: 17,
  riders: [],
  races: [],
  supporterBreakdown: {
    foundation: 250,
    reputation: 0,
    riders: 0,
    recentResults: 0,
    headquartersBonus: 0,
  },
  reachBreakdown: {
    supporters: 17,
    reputation: 0,
    leadingRiders: 0,
    recentResults: 0,
  },
} satisfies FanClubLiveData;

const MANAGEMENT = {
  shopSpecialization: null,
  fleet: {},
  trips: [],
  inventory: [],
  recentSales: [],
  wholesaleMarket: [],
  eligibleCollectorProductIds: [],
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
  it("charge les seuils et les options de réapprovisionnement dans le magasin", () => {
    const markup = renderToStaticMarkup(<FanClub headquartersLevel={1} shopLevel={5} data={LIVE_DATA}
      management={{ ...MANAGEMENT, autoRestock: { enabled: true, allowNegativeProjection: true,
        minimumStocks: { "team-jersey": 120, bottle: 45 } } }} sponsorIdentity={null} initialTab="store" />);
    expect(markup).toContain('aria-label="Réapprovisionnement automatique"');
    expect(markup).toContain('aria-label="Stock minimum de Maillot de l’équipe"');
    expect(markup).toContain('value="120"');
    expect(markup).toContain('value="45"');
    expect(markup.match(/checked=""/g)).toHaveLength(2);
    expect(markup).toContain("Aucun achat si la trésorerie est négative");
    expect(markup).toContain("Enregistrer les réglages");
    if (process.env.SHOP_PREVIEW_HTML) {
      writeFileSync(process.env.SHOP_PREVIEW_HTML, `<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{background:#f4f8f6;margin:0;font-family:Arial,sans-serif}main{max-width:1120px;margin:auto;padding:24px}@media(max-width:640px){main{padding:12px}}</style><main>${markup}</main></html>`);
    }
  });
  it("désactive le réapprovisionnement par défaut et le masque sans boutique", () => {
    const renderStore = (level: number) => renderToStaticMarkup(<FanClub headquartersLevel={1} shopLevel={level}
      data={LIVE_DATA} management={MANAGEMENT} sponsorIdentity={null} initialTab="store" />);
    expect(renderStore(1)).not.toContain('checked=""');
    expect(renderStore(1)).toContain("projection de fin de saison positive ou nulle");
    expect(renderStore(0)).not.toContain('aria-label="Réapprovisionnement automatique"');
  });
  it("regroupe tous les minimums dans les réglages automatiques, pas dans les tuiles de vente", () => {
    const markup = renderToStaticMarkup(
      <FanClub
        headquartersLevel={1}
        shopLevel={5}
        data={LIVE_DATA}
        management={{ ...MANAGEMENT, autoRestock: {
          enabled: true,
          allowNegativeProjection: false,
          minimumStocks: { "team-jersey": 120, bottle: 45 },
        } }}
        sponsorIdentity={null}
        initialTab="store"
      />,
    );
    const restockSection = markup.match(
      /<section aria-label="Réapprovisionnement automatique"[\s\S]*?<\/section>/,
    )?.[0] ?? "";
    const salesCards = markup.match(/<article[\s\S]*?<\/article>/g) ?? [];

    expect(restockSection).toContain("Minimum à maintenir par article");
    expect(restockSection).toContain('aria-label="Stock minimum de Maillot de l’équipe"');
    expect(restockSection).toContain('aria-label="Stock minimum de Bidon"');
    expect(restockSection).toContain('value="120"');
    expect(restockSection).toContain('value="45"');
    expect(restockSection.match(/aria-label="Stock minimum de /g)).toHaveLength(salesCards.length);
    expect(salesCards.length).toBeGreaterThan(1);
    for (const card of salesCards) {
      expect(card).not.toContain("Stock minimum de");
      expect(card).not.toContain("Minimum à maintenir");
      expect(card).toContain("Stock restant");
      expect(card).toContain("Ventes prévues");
      expect(card).toContain("Prix en boutique");
    }
  });
  it("inclut les collectors disponibles et conserve le blocage des minimums cumulés", () => {
    const markup = renderToStaticMarkup(
      <FanClub
        headquartersLevel={1}
        shopLevel={1}
        data={LIVE_DATA}
        management={{ ...MANAGEMENT,
          eligibleCollectorProductIds: ["collector-jersey-france"],
          autoRestock: {
            enabled: true,
            allowNegativeProjection: false,
            minimumStocks: { "team-jersey": 200, "collector-jersey-france": 150 },
          },
        }}
        sponsorIdentity={null}
        initialTab="store"
      />,
    );
    const restockSection = markup.match(
      /<section aria-label="Réapprovisionnement automatique"[\s\S]*?<\/section>/,
    )?.[0] ?? "";

    expect(restockSection).toContain('aria-label="Stock minimum de Maillot jaune collector"');
    expect(restockSection).not.toContain('aria-label="Stock minimum de Bidon"');
    expect(restockSection).toContain('min="0" max="300" step="1"');
    expect(restockSection).toContain("Les minimums cumulés (350) dépassent la capacité du magasin (300).");
    expect(restockSection).toMatch(/<button[^>]*disabled=""[^>]*>Enregistrer les réglages<\/button>/);
  });
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

  it("explique le bonus sportif et projette une note montagne à 70", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/game/fan-club.tsx"),
      "utf8",
    );

    expect(source).toContain("Multiplicateur de ferveur");
    expect(source).toContain("Bonus sur la course");
    expect(source).toContain("70 MO →");
    expect(source).toContain("√(supporters mobilisés ÷ 100)");
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

  it("dessine les trois couleurs de maillots collectors", () => {
    const yellow = renderToStaticMarkup(
      <StoreProductVisual
        productId="collector-jersey-france"
        sponsorIdentity={null}
      />,
    );
    const pink = renderToStaticMarkup(
      <StoreProductVisual
        productId="collector-jersey-italy"
        sponsorIdentity={null}
      />,
    );
    const red = renderToStaticMarkup(
      <StoreProductVisual
        productId="collector-jersey-spain"
        sponsorIdentity={null}
      />,
    );

    expect(yellow).toContain("#F2C94C");
    expect(pink).toContain("#F0A1BB");
    expect(red).toContain("#D84848");
  });

  it("ouvre directement le magasin depuis une alerte de stock", () => {
    const markup = renderToStaticMarkup(
      <FanClub
        headquartersLevel={1}
        shopLevel={1}
        data={LIVE_DATA}
        management={MANAGEMENT}
        sponsorIdentity={null}
        initialTab="store"
      />,
    );

    expect(markup).toContain("Stock et prix de vente");
    expect(markup).toContain("Rapport des ventes");
    expect(markup).toContain("Acheter du stock");
  });

  it("place le panneau d’approvisionnement sous son bouton", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/game/fan-club.tsx"),
      "utf8",
    );
    const purchaseButtonIndex = source.indexOf(">Acheter du stock</button>");
    const purchasePanelIndex = source.indexOf(
      "{purchaseOpen && selectedProduct ? (",
    );
    const inventoryGridIndex = source.indexOf(
      'className="mt-6 grid gap-4 lg:grid-cols-2"',
    );

    expect(purchaseButtonIndex).toBeGreaterThan(-1);
    expect(purchasePanelIndex).toBeGreaterThan(purchaseButtonIndex);
    expect(inventoryGridIndex).toBeGreaterThan(purchasePanelIndex);
  });
});
