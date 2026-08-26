import { describe, expect, it } from "vitest";

import { getUnlockedReferralTrophies } from "@/lib/game/referrals";
import {
  buildTrophyGallery,
  getLockedTrophyTargets,
} from "@/lib/game/trophy-gallery";

describe("buildTrophyGallery", () => {
  it("lists obtainable trophies that are still missing without revealing retired or secret awards", () => {
    const lockedTrophies = getLockedTrophyTargets([]);

    expect(lockedTrophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "locked:achievement:atlas_peloton",
          title: "Atlas du peloton",
        }),
        expect.objectContaining({
          id: "locked:referral:25",
          title: "Don du peloton",
        }),
        expect.objectContaining({
          id: "locked:race:corsa-delle-regioni",
          title: "Corsa delle Regioni",
        }),
        expect.objectContaining({
          id: "locked:world-championship:time-trial",
          title: "Maillot arc-en-ciel — CLM",
        }),
      ]),
    );
    expect(lockedTrophies.some((trophy) => trophy.title === "Alphatesteur")).toBe(
      false,
    );
    expect(
      lockedTrophies.some((trophy) => trophy.title === "Le Virage caché"),
    ).toBe(false);
  });

  it("removes a unique target from the grey catalogue once it is won", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "result-ruta",
          raceSlug: "ruta-de-las-sierras",
          raceName: "Ruta de las Sierras",
          seasonName: "Saison 4",
          wonAt: null,
          riderName: "Pablo Rojo",
          isGrandTour: true,
          isMonument: false,
        },
        {
          id: "world-road",
          raceSlug: "championnats-du-monde",
          raceName: "Championnats du monde en ligne",
          seasonName: "Saison 4",
          wonAt: null,
          riderName: "Alix Mondial",
          isGrandTour: false,
          isMonument: false,
          competitionType: "world_championship",
        },
      ],
      teamUciTitles: [],
      riderUciTitles: [],
      specialAwards: [
        {
          id: "atlas-award",
          trophyKey: "atlas_peloton",
          availableAt: "2026-08-12T12:00:00.000Z",
          claimedAt: "2026-08-12T12:00:00.000Z",
          href: "/jeu/objectifs?onglet=objectifs&groupe=diversity",
        },
      ],
    });

    const lockedTrophies = getLockedTrophyTargets(gallery.trophies);

    expect(
      lockedTrophies.some((trophy) => trophy.title === "Ruta de las Sierras"),
    ).toBe(false);
    expect(
      lockedTrophies.some((trophy) => trophy.title === "Atlas du peloton"),
    ).toBe(false);
    expect(
      lockedTrophies.some(
        (trophy) => trophy.id === "locked:world-championship:road",
      ),
    ).toBe(false);
    expect(
      lockedTrophies.some(
        (trophy) => trophy.id === "locked:world-championship:time-trial",
      ),
    ).toBe(true);
  });

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
      championships: 0,
      uciTitles: 0,
      special: 0,
      achievements: 0,
      sponsor: 0,
      attendance: 0,
      referrals: 0,
    });
    expect(gallery.trophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "grand-tour:result-pink",
          title: "Corsa delle Regioni",
          competitionName: "Trofeo Rosa delle Regioni · 1re place au général",
          inscription: "Gianni Rosa",
          palette: expect.objectContaining({ primary: "#E45A96" }),
        }),
        expect.objectContaining({
          id: "monument:result-monument",
          title: "Couronne des Ardennes",
          competitionName: "Couronne d’Émeraude · 1re place",
          palette: expect.objectContaining({ primary: "#278B70" }),
        }),
      ]),
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

  it("adds world and continental titles to the sporting director record", () => {
    const gallery = buildTrophyGallery({
      raceWins: [
        {
          id: "world-road",
          raceSlug: "championnats-du-monde-en-ligne",
          raceName: "Championnats du monde en ligne",
          seasonName: "Saison 2",
          wonAt: "2026-08-11T18:00:00.000Z",
          riderName: "Claudia Marković",
          isGrandTour: false,
          isMonument: false,
          competitionType: "world_championship",
        },
        {
          id: "continental-tt",
          raceSlug: "championnats-europe-clm",
          raceName: "Championnats d’Europe CLM",
          seasonName: "Saison 2",
          wonAt: "2026-08-07T14:00:00.000Z",
          riderName: "Claudia Marković",
          isGrandTour: false,
          isMonument: false,
          competitionType: "continental_championship",
        },
      ],
      teamUciTitles: [],
      riderUciTitles: [],
    });

    expect(gallery.counts.championships).toBe(2);
    expect(gallery.trophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "world_championship",
          title: "Championnats du monde en ligne",
        }),
        expect.objectContaining({
          kind: "continental_championship",
          title: "Championnats d’Europe CLM",
        }),
      ]),
    );
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
  });

  it("creates an Assidu trophy after a perfect season of attendance", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      attendanceTrophies: [
        {
          id: "attendance-season-5",
          seasonName: "Saison 5",
          awardedAt: "2026-08-09T20:00:00.000Z",
        },
      ],
    });

    expect(gallery.counts.attendance).toBe(1);
    expect(gallery.trophies[0]).toEqual(
      expect.objectContaining({
        id: "attendance:attendance-season-5",
        kind: "attendance",
        title: "Assidu",
        inscription: "Tous les jours · Saison complète",
        wonAt: "2026-08-09T20:00:00.000Z",
      }),
    );
  });

  it("groups every perfect sponsor season into one cumulative trophy", () => {
    const gallery = buildTrophyGallery({
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
          id: "sponsor-season-4",
          seasonName: "Saison 4",
          awardedAt: "2026-08-10T20:00:00.000Z",
        },
      ],
    });

    expect(gallery.counts).toMatchObject({ total: 1, sponsor: 1 });
    expect(gallery.trophies).toEqual([
      expect.objectContaining({
        kind: "sponsor",
        title: "Ambassadeur exemplaire",
        competitionName: "Satisfaction sponsor · 100 %",
        seasonName: "Saison 4",
        seasonNames: ["Saison 2", "Saison 4"],
      }),
    ]);
    expect(
      getLockedTrophyTargets(gallery.trophies).some(
        (trophy) => trophy.id === "locked:sponsor:ambassador",
      ),
    ).toBe(false);
  });

  it("expose les rangs de parrainage dans la galerie", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      referralTrophies: getUnlockedReferralTrophies(5),
    });

    expect(gallery.counts.referrals).toBe(2);
    expect(
      gallery.trophies.filter((trophy) => trophy.kind === "referral"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Le Parrain",
          href: "/jeu/parrainage",
        }),
      ]),
    );
  });
  it("adds difficult objective trophies with their dedicated simple mark", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      specialAwards: [
        {
          id: "atlas-award",
          trophyKey: "atlas_peloton",
          availableAt: "2026-08-12T12:00:00.000Z",
          claimedAt: "2026-08-12T12:00:00.000Z",
          href: "/jeu/objectifs?onglet=objectifs&groupe=diversity",
        },
      ],
    });

    expect(gallery.counts).toMatchObject({
      total: 1,
      special: 0,
      achievements: 1,
    });
    expect(gallery.trophies[0]).toMatchObject({
      kind: "achievement",
      title: "Atlas du peloton",
      visualVariant: "astrolabe",
    });
  });
});
