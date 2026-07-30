import { describe, expect, it } from "vitest";

import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

describe("buildTrophyGallery", () => {
  it("creates one correctly coloured trophy for every major race victory", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "result-pink",
          raceSlug: "corsa-delle-regioni",
          raceName: "Corsa delle Regioni",
          seasonName: "Saison 3",
          wonAt: "2026-07-20T12:00:00.000Z",
          riderName: "Gianni Rosa",
          isGrandTour: true,
          isMonument: false,
        },
        {
          id: "result-monument",
          raceSlug: "couronne-des-ardennes",
          raceName: "Couronne des Ardennes",
          seasonName: "Saison 2",
          wonAt: "2026-05-20T12:00:00.000Z",
          riderName: "Émile Vert",
          isGrandTour: false,
          isMonument: true,
        },
      ],
      teamUciTitles: [],
      riderUciTitles: [],
    });

    expect(gallery.counts).toEqual({
      total: 2,
      grandTours: 1,
      monuments: 1,
      uciTitles: 0,
      special: 0,
    });
    expect(gallery.trophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "grand-tour:result-pink",
          title: "Trofeo Rosa delle Regioni",
          inscription: "Gianni Rosa",
          palette: expect.objectContaining({ primary: "#E45A96" }),
        }),
        expect.objectContaining({
          id: "monument:result-monument",
          title: "Couronne d’Émeraude",
          palette: expect.objectContaining({ primary: "#278B70" }),
        }),
      ])
    );
  });

  it("places the exceptional UCI cups before race trophies and engraves riders", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "result-tour",
          raceSlug: "boucle-des-provinces",
          raceName: "Boucle des Provinces",
          seasonName: "Saison 4",
          wonAt: null,
          riderName: "Léo Jaune",
          isGrandTour: true,
          isMonument: false,
        },
      ],
      teamUciTitles: [
        { id: "team-s3", seasonName: "Saison 3", teamName: "Veloria" },
      ],
      riderUciTitles: [
        {
          id: "rider-s3",
          seasonName: "Saison 3",
          riderName: "Nino Mondial",
        },
      ],
    });

    expect(gallery.trophies.map((trophy) => trophy.kind)).toEqual([
      "uci_team",
      "uci_rider",
      "grand_tour",
    ]);
    expect(gallery.trophies[1]?.inscription).toBe("Nino Mondial");
    expect(gallery.counts.uciTitles).toBe(2);
  });

  it("ignores victories that are not major trophies", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "regular-race",
          raceSlug: "prix-du-port",
          raceName: "Prix du Port",
          seasonName: "Saison 1",
          wonAt: null,
          riderName: "Ari Vite",
          isGrandTour: false,
          isMonument: false,
        },
      ],
      teamUciTitles: [],
      riderUciTitles: [],
    });

    expect(gallery.trophies).toEqual([]);
    expect(gallery.counts.total).toBe(0);
  });

  it("adds the claimed Alphatesteur distinction before sporting trophies", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [
        { id: "team-s1", seasonName: "Saison 1", teamName: "Veloria" },
      ],
      riderUciTitles: [],
      specialAwards: [
        {
          id: "alpha-award",
          trophyKey: "alpha_tester",
          availableAt: "2026-07-30T08:00:00.000Z",
          claimedAt: "2026-07-30T09:00:00.000Z",
          href: "/jeu/directeur-sportif#distinction-avatar",
        },
      ],
      claimableTrophies: [],
    });

    expect(gallery.trophies[0]).toMatchObject({
      kind: "special",
      title: "Alphatesteur",
      avatarFrameKey: "alpha_tester",
      href: "/jeu/directeur-sportif#distinction-avatar",
    });
    expect(gallery.counts).toMatchObject({ total: 2, special: 1 });
  });});
