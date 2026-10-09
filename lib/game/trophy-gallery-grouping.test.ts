import { describe, expect, it } from "vitest";
import { getUnlockedReferralTrophies } from "@/lib/game/referrals";
import {
  buildTrophyGallery,
  formatTrophySeasons,
  getLockedTrophyTargets,
  getTrophyAwardSeasonName,
  type TrophyRaceWin,
} from "@/lib/game/trophy-gallery";

const empty = { raceWins: [], teamUciTitles: [], riderUciTitles: [] };
const raceWin: TrophyRaceWin = {
  id: "win-1",
  raceSlug: "boucle-des-provinces",
  raceName: "Boucle des Provinces",
  seasonName: "Saison 1",
  wonAt: null,
  riderName: "Coureur 1",
  isGrandTour: true,
  isMonument: false,
};

describe("cumulative DS trophies", () => {
  it("merges editions of the same race despite renamed editions, keeping every winner", () => {
    const gallery = buildTrophyGallery({
      ...empty,
      raceWins: [
        { ...raceWin, id: "win-10", seasonName: "Saison 10", riderName: "Coureur 10" },
        raceWin,
        { ...raceWin, id: "win-2", seasonName: "Saison 2", raceName: "Boucle des Provinces 2", riderName: "Coureur 2" },
        raceWin,
      ],
    });
    expect(gallery.counts).toMatchObject({ total: 1, grandTours: 1 });
    expect(gallery.trophies[0]).toMatchObject({
      title: "Boucle des Provinces",
      seasonName: "Saison 10",
      seasonNames: ["Saison 1", "Saison 2", "Saison 10"],
      inscription: "Coureur 1 · Coureur 2 · Coureur 10",
    });
    expect(gallery.trophies[0].wins?.map((win) => win.id)).toEqual([
      "grand-tour:win-1", "grand-tour:win-2", "grand-tour:win-10",
    ]);
    expect(formatTrophySeasons(gallery.trophies[0])).toBe("(S1/2/10)");
    expect(getLockedTrophyTargets(gallery.trophies).some(
      (trophy) => trophy.id === "locked:race:boucle-des-provinces",
    )).toBe(false);
  });

  it("keeps different races, championship disciplines and continents separate", () => {
    const gallery = buildTrophyGallery({
      ...empty,
      raceWins: [
        { ...raceWin, isGrandTour: false, isMonument: true },
        { ...raceWin, id: "other", raceSlug: "other-race", isGrandTour: false, isMonument: true },
        ...["world-road", "world-clm", "europe-road", "africa-road"].flatMap((slug) =>
          [1, 2].map((season) => ({
            ...raceWin, id: `${slug}-${season}`, raceSlug: slug,
            raceName: slug, seasonName: `Saison ${season}`,
            isGrandTour: false,
            competitionType: slug.startsWith("world")
              ? "world_championship" as const : "continental_championship" as const,
          })),
        ),
      ],
    });
    expect(gallery.counts).toMatchObject({ total: 6, monuments: 2, championships: 4 });
    expect(gallery.trophies.filter((trophy) => trophy.kind.includes("championship")))
      .toHaveLength(4);
    expect(gallery.trophies.find((trophy) => trophy.title === "world-clm"))
      .toMatchObject({ championshipVisualVariant: "world-time-trial", seasonNames: ["Saison 1", "Saison 2"] });
  });

  it("merges UCI titles, attendance and sponsor trophies across teams and riders", () => {
    const gallery = buildTrophyGallery({
      ...empty,
      teamUciTitles: [2, 1].map((season) => ({ id: `team-${season}`, seasonName: `Saison ${season}`, teamName: `Équipe ${season}` })),
      riderUciTitles: [2, 1].map((season) => ({ id: `rider-${season}`, seasonName: `Saison ${season}`, riderName: `Coureur ${season}` })),
      attendanceTrophies: [2, 1].map((season) => ({ id: `attendance-${season}`, seasonName: `Saison ${season}`, awardedAt: `2026-0${season}-01T12:00:00Z` })),
      sponsorAmbassadorTrophies: [2, 1].map((season) => ({ id: `sponsor-${season}`, seasonName: `Saison ${season}`, awardedAt: `2026-0${season}-01T12:00:00Z` })),
    });
    expect(gallery.counts).toMatchObject({ total: 4, uciTitles: 2, attendance: 1, sponsor: 1 });
    for (const trophy of gallery.trophies) {
      expect(trophy.seasonNames).toEqual(["Saison 1", "Saison 2"]);
      expect(trophy.wins).toHaveLength(2);
    }
  });

  it("covers special, achievement, medical and referral distinctions without merging different awards", () => {
    const referrals = getUnlockedReferralTrophies(5);
    const gallery = buildTrophyGallery({
      ...empty,
      specialAwards: ["alpha_tester", "atlas_peloton", "ambulancier", "medecin_urgentiste"].flatMap((key) =>
        [1, 2].map((season) => ({
          id: `${key}-${season}`,
          trophyKey: key as "alpha_tester" | "atlas_peloton" | "ambulancier" | "medecin_urgentiste",
          seasonName: `Saison ${season}`,
          availableAt: "2026-08-01T12:00:00Z", claimedAt: "2026-08-01T12:00:00Z", href: null,
        })),
      ),
      referralTrophies: [...referrals, ...referrals],
    });
    expect(gallery.counts).toMatchObject({ total: 6, special: 1, achievements: 1, medical: 2, referrals: 2 });
    for (const trophy of gallery.trophies.filter((trophy) => trophy.kind !== "referral")) {
      expect(formatTrophySeasons(trophy)).toBe("(S1/2)");
    }
    expect(getLockedTrophyTargets(gallery.trophies).filter((trophy) => trophy.kind === "referral"))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "locked:referral:5" })]));
  });

  it("lists a season only once even when two different riders won that trophy in it", () => {
    const trophy = buildTrophyGallery({ ...empty, raceWins: [raceWin, { ...raceWin, id: "second", riderName: "Autre coureur" }] }).trophies[0];
    expect(trophy.wins).toHaveLength(2);
    expect(trophy.seasonNames).toEqual(["Saison 1"]);
    expect(formatTrophySeasons(trophy)).toBe("(S1)");
  });

  it.each([
    [["Saison 3", "S1", "Saison 2", "S1"], "(S1/2/3)"],
    [["Édition 10", "Édition 2"], "(Éd. 2/10)"],
    [["Phase Alpha"], "(Phase Alpha)"],
    [["Carrière"], "(Carrière)"],
    [["Édition spéciale", "Saison 2"], "(Édition spéciale / Saison 2)"],
  ])("formats seasons and editions without inventing a season (%s)", (seasonNames, expected) => {
    const trophy = buildTrophyGallery({ ...empty, raceWins: [raceWin] }).trophies[0];
    expect(formatTrophySeasons({ ...trophy, seasonNames })).toBe(expected);
  });
});

describe("award season attribution", () => {
  const seasons = [
    { name: "Saison 3", starts_on: "2026-09-11", ends_on: "2026-10-08" },
    { name: "Saison 4", starts_on: "2026-10-09", ends_on: "2026-11-05" },
  ];
  it("uses the award date in Paris, including season rollover at midnight", () => {
    expect(getTrophyAwardSeasonName("2026-10-08T21:59:59Z", seasons)).toBe("Saison 3");
    expect(getTrophyAwardSeasonName("2026-10-08T22:00:00Z", seasons)).toBe("Saison 4");
  });
  it("leaves unknown or invalid dates unattributed", () => {
    expect(getTrophyAwardSeasonName("2026-01-01T12:00:00Z", seasons)).toBeUndefined();
    expect(getTrophyAwardSeasonName("invalid", seasons)).toBeUndefined();
  });
});
