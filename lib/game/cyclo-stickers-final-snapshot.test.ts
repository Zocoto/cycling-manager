import { describe, expect, it } from "vitest";
import { CYCLO_STICKERS_FINAL_TITLE_SLOTS, assertReviewedCycloStickersFinalSnapshot, createCycloStickersFinalSnapshot } from "./cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "./cyclo-stickers-final-snapshot.fixture";

describe("offline final S4 snapshot preparation", () => {
  it("links separately captured active-S4 identities without treating active sporting facts as final", () => {
    const source = createFinalCycloStickersSourceFixture();
    source.identityCapture = {
      kind: "s4-active-identity-evidence", sourceSeasonId: source.season.id, sourceSeasonStatus: "active",
      capturedAt: "2026-11-05T09:23:33.000Z", capturedUntil: "2026-11-05T09:23:38.000Z", sha256: "a".repeat(64),
    };
    const snapshot = createCycloStickersFinalSnapshot(source);
    expect(snapshot.provenance.source.identityCapture).toEqual(source.identityCapture);
    expect(() => assertReviewedCycloStickersFinalSnapshot(snapshot, "completed")).not.toThrow();
    expect(() => createCycloStickersFinalSnapshot({ ...source, season: { ...source.season, status: "active" } })).toThrow();
    const changes = [
      { sourceSeasonId: source.riders[0].id },
      { capturedAt: "2026-10-08T09:00:00.000Z" },
      { capturedUntil: "2026-11-07T09:00:00.000Z" },
      { capturedUntil: "2026-11-05T09:23:32.000Z" },
      { sourceSeasonStatus: "completed" },
      { sha256: "not-a-checksum" },
    ];
    for (const change of changes) expect(() => createCycloStickersFinalSnapshot({ ...source, identityCapture: { ...source.identityCapture, ...change } })).toThrow();
    expect(() => createCycloStickersFinalSnapshot({ ...source, capturedAt: "2026-11-06T08:00:00.000Z", identityCapture: { ...source.identityCapture, capturedAt: "2026-11-06T08:00:00.000Z", capturedUntil: "2026-11-06T09:00:00.000Z" } })).toThrow();
  });

  it("builds every numbered slot from completed official rows, including champions outside the top 50", () => {
    const source = createFinalCycloStickersSourceFixture();
    const before = structuredClone(source);
    const snapshot = createCycloStickersFinalSnapshot(source);
    expect(source).toEqual(before);
    expect(snapshot.cards).toHaveLength(69);
    expect(snapshot.cards.map(card => card.number)).toEqual(Array.from({ length: 69 }, (_, index) => index + 1));
    expect(snapshot.cards.slice(0, 50).map(card => card.id)).toEqual(source.ranking.map(row => row.riderId));
    expect(snapshot.cards.slice(50, 55).every(card => card.kind === "team")).toBe(true);
    expect(snapshot.cards.slice(55, 65).every(card => card.kind === "continental")).toBe(true);
    expect(snapshot.cards.slice(65, 67).every(card => card.kind === "world")).toBe(true);
    expect(snapshot.cards[67].kind).toBe("games");
    expect(snapshot.cards[68].id).toBe("intro:legend:headless-s4");
    for (const [index, slot] of CYCLO_STICKERS_FINAL_TITLE_SLOTS.entries()) {
      const champion = source.championships.find(row => row.type === slot)!;
      const rider = source.riders.find(row => row.id === champion.riderId)!;
      expect(snapshot.cards[index + 55].name).toBe(rider.name);
      expect(snapshot.cards[index + 55].ratings).toEqual(rider.ratings);
    }
    expect(source.ranking.some(row => row.riderId === source.championships[12].riderId)).toBe(false);
    expect(snapshot.cards[67].name).toBe(source.riders[56].name);
    expect(() => assertReviewedCycloStickersFinalSnapshot(snapshot, "completed")).not.toThrow();
  });

  it("preserves official UCI tie order and frozen team identities rather than choosing a new tie break", () => {
    const source = createFinalCycloStickersSourceFixture();
    [source.ranking[0].riderId, source.ranking[1].riderId] = [source.ranking[1].riderId, source.ranking[0].riderId];
    const snapshot = createCycloStickersFinalSnapshot(source);
    expect(snapshot.cards[0].id).toBe(source.riders[1].id);
    expect(snapshot.cards[0].points).toBe(snapshot.cards[1].points);
    expect(snapshot.cards[50].jersey).toEqual(source.teams[0].jersey);
    expect(snapshot.cards[50].name).toBe(source.teams[0].name);
  });

  it("keeps source provenance independent from displayed cards and does not invent souvenir sporting data", () => {
    const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
    const originalRating = snapshot.provenance.source.riders[0].ratings.mountain;
    snapshot.cards[0].ratings.mountain += 1;
    expect(snapshot.provenance.source.riders[0].ratings.mountain).toBe(originalRating);
    expect(() => assertReviewedCycloStickersFinalSnapshot(snapshot, "completed")).toThrow();
    for (const card of [snapshot.cards[50], snapshot.cards[68]]) {
      expect(card.age).toBe(0);
      expect(card.honours).toEqual([]);
      expect(card.worldTitles).toEqual([]);
      expect(Object.values(card.ratings).every(value => value === 0)).toBe(true);
    }
  });

  it.each([
    ["active S4", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, season: { ...source.season, status: "active" } })],
    ["premature capture", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, capturedAt: "2026-11-04T22:00:00Z" })],
    ["invalid timestamp", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, capturedAt: "yesterday" })],
    ["wrong season metadata", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, season: { ...source.season, gameYear: 3 } })],
    ["incomplete champion list", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, championships: source.championships.slice(1) })],
    ["missing outsider native profile", (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => ({ ...source, riders: source.riders.slice(0, 56) })],
  ])("rejects %s before producing a final candidate", (_label, change) => {
    expect(() => createCycloStickersFinalSnapshot(change(createFinalCycloStickersSourceFixture()))).toThrow();
  });

  it("rejects mixed source seasons, duplicate slots, non-pro titles and malformed finite fields", () => {
    const mutations = [
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].ratingsSeasonId = source.riders[0].id; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].jerseySeasonId = source.riders[0].id; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].contractSeasonId = source.riders[0].id; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].honours[0].sourceSeasonId = source.riders[0].id; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.championships[1] = { ...source.championships[0] }; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.ranking[1].rank = 1; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.ranking[1].points = Infinity; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].ratings.flat = NaN; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].ratings.sprint = 101; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.riders[0].name = "Spécimen de collection"; },
      (source: ReturnType<typeof createFinalCycloStickersSourceFixture>) => { source.teams[0].name = "Nouveau sponsor S5"; },
    ];
    for (const mutate of mutations) {
      const source = createFinalCycloStickersSourceFixture();
      mutate(source);
      expect(() => createCycloStickersFinalSnapshot(source)).toThrow();
    }
    const source = createFinalCycloStickersSourceFixture();
    expect(() => createCycloStickersFinalSnapshot({ ...source, championships: source.championships.map(row => ({ ...row, category: "u23" })) })).toThrow();
  });

  it("rejects forged final cards, special slot order, title jerseys, provenance and edition metadata", () => {
    const final = () => createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
    const changes = [
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[0].points += 1; },
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[0].specimen = true; },
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[50].kind = "world"; },
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[55].jersey.continentCode = "oceania"; },
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[67].jersey.championshipType = "time_trial"; },
      (snapshot: ReturnType<typeof final>) => { snapshot.cards[68].victories = 1; },
      (snapshot: ReturnType<typeof final>) => { snapshot.sourceSeasonId = snapshot.cards[0].id; },
      (snapshot: ReturnType<typeof final>) => { snapshot.capturedAt = ""; },
      (snapshot: ReturnType<typeof final>) => { snapshot.edition = "s4-preview"; },
      (snapshot: ReturnType<typeof final>) => { snapshot.provenance.source.riders[0].ratings.flat = 99; },
    ];
    for (const change of changes) {
      const snapshot = final();
      change(snapshot);
      expect(() => assertReviewedCycloStickersFinalSnapshot(snapshot, "completed")).toThrow();
    }
    const snapshot = final();
    const unproven = { ...snapshot, provenance: undefined };
    expect(() => assertReviewedCycloStickersFinalSnapshot(unproven, "completed")).toThrow();
    expect(() => assertReviewedCycloStickersFinalSnapshot(snapshot, "active")).toThrow();
    expect(() => assertReviewedCycloStickersFinalSnapshot(null, "completed")).toThrow();
  });
});
