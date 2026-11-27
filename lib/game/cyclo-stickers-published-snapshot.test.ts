import { describe, expect, it } from "vitest";
import { createCycloStickersFinalSnapshot } from "./cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "./cyclo-stickers-final-snapshot.fixture";
import { assertPublishedCycloStickersSnapshot } from "./cyclo-stickers-published-snapshot";

function futureReadModel() {
  const card = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture()).cards[0];
  const sourceSeasonId = "10000000-0000-4000-8000-000000000005";
  // This is an isolated reader contract fixture, not a publication candidate.
  return {
    edition: "synthetic-s5-reader", sourceSeason: 5, collectionSeason: 6,
    sourceSeasonId, ratingsFrozenFromSeason: 5, presentationSeason: 5,
    launchSeason: 6, gamesEdition: false, sourceSeasonStatus: "completed" as const,
    capturedAt: "2026-12-04T00:05:00.000Z", cards: [card],
    provenance: { schemaVersion: 1, source: { season: { id: sourceSeasonId, gameYear: 5, status: "completed" } } },
  };
}

describe("published catalogue reader boundary", () => {
  it("accepts a future reader shape while retaining the independent publication pipeline", () => {
    expect(() => assertPublishedCycloStickersSnapshot(futureReadModel())).not.toThrow();
  });

  it("rejects incomplete sources and mismatched source, frozen or collection seasons", () => {
    const fixture = futureReadModel();
    for (const candidate of [
      { ...fixture, sourceSeasonStatus: "active" },
      { ...fixture, ratingsFrozenFromSeason: 4 },
      { ...fixture, collectionSeason: 7 },
      { ...fixture, provenance: { schemaVersion: 1, source: { season: { ...fixture.provenance.source.season, gameYear: 4 } } } },
    ]) expect(() => assertPublishedCycloStickersSnapshot(candidate)).toThrow();
  });

  it("rejects demonstration cards, unsafe jersey assets and ambiguous sticker identities", () => {
    const fixture = futureReadModel();
    const first = fixture.cards[0];
    for (const cards of [
      [{ ...first, specimen: true }],
      [{ ...first, jersey: { ...first.jersey, imagePath: "/images/../private.webp" } }],
      [{ ...first, number: 2 }],
      [first, { ...first, number: 2 }],
    ]) expect(() => assertPublishedCycloStickersSnapshot({ ...fixture, cards })).toThrow();
  });
});
