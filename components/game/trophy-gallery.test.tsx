import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
        {
          id: "world-win",
          raceSlug: "championnats-du-monde-clm",
          raceName: "Championnats du monde CLM",
          seasonName: "Saison 4",
          wonAt: "2026-08-11T14:00:00.000Z",
          riderName: "Alix Mondial",
          isGrandTour: false,
          isMonument: false,
          competitionType: "world_championship",
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
    expect(markup).toContain("Ruta de las Sierras");
    expect(markup).toContain("Copa Roja de las Sierras");
    expect(markup).toContain("Championnats du monde &amp; continentaux");
    expect(markup).toContain("Championnats du monde CLM");
    expect(markup).toContain("CM &amp; CC");
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

  it("resserre les compteurs sur téléphone pour garder les libellés lisibles", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
        })}
      />
    );

    expect(markup).toContain("data-trophy-metrics");
    expect(markup).toContain("gap-1.5");
    expect(markup).toContain("data-trophy-metric");
    expect(markup).toContain("text-[7px]");
    expect(markup).toContain("min-[390px]:text-[8px]");
    expect(markup).toContain("sm:text-[9px]");
  });
  it("renders the unopened Alphatesteur gift before adding it to the gallery", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
          claimableTrophies: [
            {
              key: "alpha_tester",
              availableAt: "2026-07-30T08:00:00.000Z",
              title: "Alphatesteur",
              description: "Distinction Alpha",
              avatarFrameKey: "alpha_tester",
              palette: {
                primary: "#48D9C0",
                secondary: "#D7FFF8",
                accent: "#342A64",
                glow: "rgba(72, 217, 192, 0.42)",
              },
            },
          ],
        })}
      />
    );

    expect(markup).toContain("Un cadeau vous attend");
    expect(markup).toContain("Ouvrir mon cadeau");
    expect(markup).not.toContain("Le premier socle vous attend");
  });

  it("renders the academic Assidu trophy skin and its avatar reward", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
          attendanceTrophies: [
            {
              id: "attendance-season-3",
              seasonName: "Saison 3",
              awardedAt: "2026-08-09T20:00:00.000Z",
            },
          ],
        })}
      />,
    );

    expect(markup).toContain("Assiduité parfaite");
    expect(markup).toContain("Présence parfaite");
    expect(markup).toContain("data-assidu-trophy");
    expect(markup).toContain("lunettes Premier de la classe");
    expect(markup).not.toContain("28 cadeaux quotidiens");
  });
});
