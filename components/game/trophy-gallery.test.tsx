import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/jeu/actions", () => ({
  discoverHiddenSwitchbackAction: vi.fn(async () => ({
    ok: true,
    message: "Registre ouvert",
  })),
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
    expect(markup).toContain('data-uci-trophy="team"');
    expect(markup).toContain('data-uci-trophy="rider"');
    expect(markup).toContain(
      'data-championship-trophy="world-time-trial"',
    );
    expect(markup).toContain('data-championship-emblem="rainbow-chrono"');
    expect(markup).not.toContain("Challenges longue durée");
    expect(markup).not.toContain("En cours de développement");
    expect(markup).not.toContain("Critères à définir ensemble");
    expect(markup).toContain("/jeu/resultats/ruta-de-las-sierras");
    expect(markup).toContain("Registre des graveurs");
    for (const visualVariant of [
      "regional_rose",
      "province_wheel",
      "sierra_peaks",
      "amber_cobble",
      "zeeland_lion",
      "flanders_bell",
      "ardennes_crown",
      "lake_chalice",
    ]) {
      expect(markup).toContain(
        `data-prestige-race-trophy="${visualVariant}"`,
      );
    }
    expect(markup.match(/data-prestige-race-trophy=/g)).toHaveLength(8);
    expect(markup).not.toContain("/images/race-trophies/");
  });

  it("shows the obtainable trophies in grey without granting them", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
        })}
      />,
    );

    expect(markup).toContain('data-trophy-status="locked"');
    expect(markup).toContain("À débloquer");
    expect(markup).toContain("Atlas du peloton");
    expect(markup).toContain("Jusqu’au bout de la nuit");
    expect(markup).toContain('data-achievement-trophy-mark="midnight-auction"');
    expect(markup).toContain("/jeu/transferts");
    expect(markup).toContain("Corsa delle Regioni");
    expect(markup).toContain("Remporter le classement général");
    expect(markup).not.toContain('data-trophy-status="earned"');
    expect(markup).not.toContain("Alphatesteur");
    expect(markup).not.toContain("Le Virage caché");
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
      />,
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
      />,
    );

    expect(markup).toContain("Un cadeau vous attend");
    expect(markup).toContain("Ouvrir mon cadeau");
    expect(markup).toContain('data-trophy-status="locked"');
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

  it("celebrates perfect sponsor seasons with the dedicated cumulative trophy", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
          sponsorAmbassadorTrophies: [
            {
              id: "sponsor-season-2",
              seasonName: "Saison 2",
              awardedAt: "2026-06-10T20:00:00.000Z",
            },
            {
              id: "sponsor-season-3",
              seasonName: "Saison 3",
              awardedAt: "2026-07-10T20:00:00.000Z",
            },
          ],
        })}
      />,
    );

    expect(markup).toContain("Excellence sponsor");
    expect(markup).toContain("Ambassadeur exemplaire");
    expect(markup).toContain("data-sponsor-ambassador-trophy");
    expect(markup).toContain("Saison 2");
    expect(markup).toContain("Saison 3");
    expect(markup).toContain("Maillot d’Or des Ambassadeurs");
  });

  it("renders the medical crisis shelf, its two marks and rewards", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
          specialAwards: [
            {
              id: "ambulancier-award",
              trophyKey: "ambulancier",
              availableAt: "2026-08-26T10:00:00.000Z",
              claimedAt: "2026-08-26T10:00:00.000Z",
              href: "/jeu/directeur-sportif#medical-avatar-outfits",
            },
            {
              id: "urgentiste-award",
              trophyKey: "medecin_urgentiste",
              availableAt: "2026-08-26T11:00:00.000Z",
              claimedAt: "2026-08-26T11:00:00.000Z",
              href: "/jeu/directeur-sportif#medical-avatar-outfits",
            },
          ],
        })}
      />,
    );

    expect(markup).toContain("Urgences du peloton");
    expect(markup).toContain("Ambulancier");
    expect(markup).toContain("Médecin urgentiste");
    expect(markup).toContain('data-medical-trophy="nurse"');
    expect(markup).toContain('data-medical-trophy="emergency-doctor"');
    expect(markup).toContain("25 000 €");
    expect(markup).toContain("75 000 €");
  });

  it("gives every referral milestone a distinct emblem instead of the generic cross", () => {
    const markup = renderToStaticMarkup(
      <TrophyGallery
        gallery={buildTrophyGallery({
          raceWins: [],
          teamUciTitles: [],
          riderUciTitles: [],
          referralTrophies: [
            {
              count: 1,
              title: "Entremetteur du peloton",
              inscription: "1 filleul qualifié",
              palette: {
                primary: "#B87333",
                secondary: "#F4D0A6",
                accent: "#4B2513",
                glow: "rgba(184, 115, 51, 0.38)",
              },
            },
            {
              count: 5,
              title: "Le Parrain",
              inscription: "5 filleuls qualifiés",
              palette: {
                primary: "#D8D8D3",
                secondary: "#FFFFFF",
                accent: "#171514",
                glow: "rgba(216, 216, 211, 0.46)",
              },
            },
            {
              count: 10,
              title: "Parrain influent",
              inscription: "10 filleuls qualifiés",
              palette: {
                primary: "#D4AF37",
                secondary: "#FFF0A8",
                accent: "#4B3500",
                glow: "rgba(212, 175, 55, 0.48)",
              },
            },
            {
              count: 25,
              title: "Don du peloton",
              inscription: "25 filleuls qualifiés",
              palette: {
                primary: "#20201F",
                secondary: "#E7E2D8",
                accent: "#9B1C31",
                glow: "rgba(155, 28, 49, 0.42)",
              },
            },
          ],
        })}
      />,
    );

    for (const milestone of [1, 5, 10, 25]) {
      expect(markup).toContain(
        `data-referral-trophy="milestone-${milestone}"`,
      );
    }
    for (const emblem of ["link", "patron", "signal", "legacy"]) {
      expect(markup).toContain(`data-referral-emblem="${emblem}"`);
    }
  });
});
