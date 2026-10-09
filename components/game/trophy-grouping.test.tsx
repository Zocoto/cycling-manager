import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SportingDirectorTrophyTile } from "@/components/game/sporting-director-trophy-tile";
import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/jeu/actions", () => ({ discoverHiddenSwitchbackAction: vi.fn() }));

const gallery = buildTrophyGallery({
  raceWins: [3, 1, 2].map((season) => ({
    id: `win-${season}`,
    raceSlug: "boucle-des-provinces",
    raceName: "Boucle des Provinces",
    seasonName: `Saison ${season}`,
    wonAt: null,
    riderName: `Coureur ${season}`,
    isGrandTour: true,
    isMonument: false,
  })),
  teamUciTitles: [],
  riderUciTitles: [],
});

describe("merged trophy rendering", () => {
  it("shows one public trophy with the seasons underneath and no redundant hidden cards", () => {
    const markup = renderToStaticMarkup(<SportingDirectorTrophyTile gallery={gallery} />);
    expect(markup.match(/data-public-trophy="grand_tour"/g)).toHaveLength(1);
    expect(markup).toContain("(S1/2/3)");
    expect(markup).toContain("Saisons ou éditions remportées : Saison 1, Saison 2, Saison 3");
    expect(markup.indexOf("(S1/2/3)")).toBeGreaterThan(markup.indexOf("Boucle des Provinces</span>"));
    expect(markup).not.toContain("<details");
  });

  it("shows one earned gallery card, all winners and no locked duplicate of the same race", () => {
    const markup = renderToStaticMarkup(<TrophyGallery gallery={gallery} />);
    expect(markup.match(/data-trophy-status="earned"/g)).toHaveLength(1);
    expect(markup.match(/data-trophy-seasons/g)).toHaveLength(1);
    expect(markup).toContain("(S1/2/3)");
    expect(markup).toContain("Coureur 1 · Coureur 2 · Coureur 3");
    expect(markup.indexOf("(S1/2/3)")).toBeGreaterThan(markup.indexOf("Boucle des Provinces</h4>"));
    expect(markup).not.toContain("/jeu/courses/boucle-des-provinces");
  });
});
