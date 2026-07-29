import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

describe("TrophyGallery", () => {
  it("renders historic trophies, their engraved winner and gallery totals", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "tour-win",
          raceSlug: "ruta-de-las-sierras",
          raceName: "Ruta de las Sierras",
          seasonName: "Saison 4",
          wonAt: "2026-07-20T12:00:00.000Z",
          riderName: "Pablo Rojo",
          isGrandTour: true,
          isMonument: false,
        },
      ],
      teamUciTitles: [
        { id: "uci-team", seasonName: "Saison 3", teamName: "Veloria" },
      ],
      riderUciTitles: [
        {
          id: "uci-rider",
          seasonName: "Saison 3",
          riderName: "Alix Mondial",
        },
      ],
    });

    const markup = renderToStaticMarkup(<TrophyGallery gallery={gallery} />);

    expect(markup).toContain("Galerie des trophées");
    expect(markup).toContain("Copa Roja de las Sierras");
    expect(markup).toContain("Alix Mondial");
    expect(markup).toContain("Coupe UCI des équipes");
    expect(markup.match(/En cours de développement/g)).toHaveLength(3);
    expect(markup).not.toContain("Critères à définir ensemble");
    expect(markup).toContain("/jeu/resultats/ruta-de-las-sierras");
  });

  it("shows an explanatory empty room without granting challenge trophies", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
        })}
      />
    );

    expect(markup).toContain("Le premier socle vous attend");
    expect(markup).not.toContain("Les emplacements sont prêts");
    expect(markup).not.toContain("Récompense débloquée");
  });
});
