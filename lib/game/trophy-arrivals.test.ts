import { describe, expect, it } from "vitest";

import { buildTrophyGalleryHref, getTrophyArrivals, getTrophyCardAnchor } from "@/lib/game/trophy-arrivals";
import { buildTrophyGallery, type CareerTrophy } from "@/lib/game/trophy-gallery";
import { getDirectorMessageActionHref } from "@/lib/game/director-mailbox";

const gallery = buildTrophyGallery({
  raceWins: [1, 2].map((season) => ({
    id: `win-${season}`, raceSlug: "tour-de-france", raceName: "Tour de France",
    seasonName: `Saison ${season}`, wonAt: `2026-0${season}-20T12:00:00Z`,
    riderName: `Lauréat ${season}`, isGrandTour: true, isMonument: false,
  })),
  teamUciTitles: [], riderUciTitles: [],
});

describe("trophy arrivals", () => {
  it("targets a new award inside a merged trophy, not all its historic wins", () => {
    const arrivals = getTrophyArrivals({ trophies: gallery.trophies, notices: [{ sourceReference: "race:win-2", kind: "grand_tour" }] });
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]).toMatchObject({ trophyId: gallery.trophies[0].id, isNew: true, win: { id: "grand-tour:win-2", seasonName: "Saison 2", riderName: "Lauréat 2" } });
    expect(gallery.trophies[0].wins).toHaveLength(2);
  });

  it("opens the exact award from old mail without calling it new", () => {
    expect(getTrophyArrivals({ trophies: gallery.trophies, focusedSource: "race:win-1" })[0])
      .toMatchObject({ isNew: false, win: { seasonName: "Saison 1" } });
  });

  it("prioritizes explicit mail over newer notices and deduplicates awards", () => {
    const arrivals = getTrophyArrivals({ trophies: gallery.trophies, focusedSource: "race:win-1", notices: [
      { sourceReference: "race:win-2", kind: "grand_tour" },
      { sourceReference: "race:win-1", kind: "grand_tour" },
    ] });
    expect(arrivals.map((arrival) => arrival.win.id)).toEqual(["grand-tour:win-1", "grand-tour:win-2"]);
    expect(arrivals.every((arrival) => arrival.isNew)).toBe(true);
  });

  it.each([
    ["special:award", "special:award", "special"],
    ["special:award", "achievement:award", "achievement"],
    ["special:award", "medical:award", "medical"],
    ["sponsor:award", "sponsor-ambassador:award", "sponsor"],
    ["attendance:award", "attendance:award", "attendance"],
    ["uci-team:award", "uci-team:award", "uci_team"],
    ["uci-rider:award", "uci-rider:award", "uci_rider"],
    ["referral:5", "referral:5", "referral"],
    ["race:award", "monument:award", "monument"],
    ["race:award", "world-championship:award", "world_championship"],
    ["race:award", "continental-championship:award", "continental_championship"],
  ])("resolves %s to %s (%s)", (source, id, kind) => {
    const trophy = { ...gallery.trophies[0], id, kind: kind as CareerTrophy["kind"], wins: undefined };
    expect(getTrophyArrivals({ trophies: [trophy], focusedSource: source })[0]?.trophyId).toBe(id);
  });

  it("ignores unknown, unavailable, malformed and foreign awards", () => {
    for (const focusedSource of ["race:other-player", "special:<script>", "race:", "x:win-1", "", "race:win-1&other=bad"]) {
      expect(getTrophyArrivals({ trophies: gallery.trophies, focusedSource })).toEqual([]);
    }
  });

  it("builds bounded, encoded links and DOM-safe anchors", () => {
    expect(buildTrophyGalleryHref("trophy:race:win-1")).toBe("/jeu/objectifs?onglet=trophees&trophee=race%3Awin-1");
    expect(buildTrophyGalleryHref("race:<script>")).toBeNull();
    expect(buildTrophyGalleryHref(`race:${"a".repeat(81)}`)).toBeNull();
    expect(getTrophyCardAnchor("grand-tour:win-1")).toBe("trophee-grand-tour-win-1");
  });
});

describe("trophy mail links", () => {
  const message = { type: "trophy" as const, href: "/jeu/objectifs?onglet=trophees", sourceReference: "trophy:sponsor:award" };
  it("enriches old and future mail using its existing source reference", () => {
    expect(getDirectorMessageActionHref(message)).toBe("/jeu/objectifs?onglet=trophees&trophee=sponsor%3Aaward");
  });
  it("preserves inventory rewards, non-trophy mail and already-targeted links", () => {
    for (const other of [
      { ...message, href: "/jeu/inventaire" },
      { ...message, type: "system" as const },
      { ...message, sourceReference: null },
      { ...message, sourceReference: "trophy:unknown:award" },
      { ...message, href: "/jeu/objectifs?onglet=trophees&trophee=referral%3A5" },
    ]) expect(getDirectorMessageActionHref(other)).toBe(other.href);
  });
});
