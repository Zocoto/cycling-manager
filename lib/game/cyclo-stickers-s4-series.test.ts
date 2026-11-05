import { expect, it } from "vitest";
import series from "@/data/collector-album-s4-preview.json";
import pilot from "@/data/collector-album-pilot.json";
import { ALBUM_ACHIEVEMENTS, createAlbumPilotState, getAlbumAchievementProgress, type CollectorAlbumSnapshot } from "./collector-album";
import { assertReviewedCycloStickersFinalSnapshot, createCycloStickersPreparedSnapshot, createCycloStickersFinalSnapshot } from "./cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "./cyclo-stickers-final-snapshot.fixture";

it("keeps a distinct genuine native S4 series, never a relabelled S3 prototype", () => {
  expect(series).toMatchObject({ sourceSeason: 4, ratingsFrozenFromSeason: 4, sourceSeasonStatus: "active", edition: "cyclo-stickers-s4-preview-s4-v1" });
  expect(series.cards).toHaveLength(72);
  const overlapping = series.cards.slice(0, 50).filter(card => pilot.cards.some(old => old.id === card.id));
  expect(overlapping.length).toBeGreaterThan(0);
  for (const card of overlapping) expect(card.ratings).not.toEqual(pilot.cards.find(old => old.id === card.id)!.ratings);
  expect(series.cards.slice(0, 50).every(card => card.jersey.imagePath?.startsWith("/images/collector-albums/s4/"))).toBe(true);
  expect(() => assertReviewedCycloStickersFinalSnapshot(series, "completed")).toThrow();
});
it("uses the same S4 card assembly for provisional and completed facts without accepting active public provenance", () => {
  const source = createFinalCycloStickersSourceFixture(); source.capturedAt = `${source.season.endsOn}T11:00:00.000Z`;
  const preview = createCycloStickersPreparedSnapshot({ ...source, season: { ...source.season, status: "active" } });
  const final = createCycloStickersFinalSnapshot(source);
  expect(preview.cards).toEqual(final.cards);
  expect(preview.sourceSeasonStatus).toBe("active"); expect(final.sourceSeasonStatus).toBe("completed");
  expect(() => createCycloStickersPreparedSnapshot({ ...source, season: { ...source.season, gameYear: 3, status: "active" } })).toThrow();
  expect(() => createCycloStickersFinalSnapshot({ ...source, season: { ...source.season, status: "active" } })).toThrow();
});
it("completes the Baroudeur chapter only by pasting its three genuine S4 riders", () => {
  const cards = (series as CollectorAlbumSnapshot).cards;
  const achievement = ALBUM_ACHIEVEMENTS.find(row => row.id === "profile-breakaway")!;
  const baroudeurs=cards.filter(card => !card.kind && card.profileKey === "breakaway");
  expect(baroudeurs).toHaveLength(3);
  expect(baroudeurs.map(card=>card.number)).toEqual([70,71,72]);
  expect(baroudeurs.every(card=>card.rank>50&&card.profile.startsWith("Baroudeur"))).toBe(true);
  expect(cards.filter(card=>!card.kind)).toHaveLength(53);
  const state = createAlbumPilotState(5, cards);
  state.pasted = cards.filter(card=>card.number<=69).map(card=>card.number);
  expect(getAlbumAchievementProgress(achievement, state, cards)).toEqual({ value: 0, target: 3 });
  state.pasted.push(70,71);
  expect(getAlbumAchievementProgress(achievement, state, cards)).toEqual({ value: 2, target: 3 });
  state.pasted.push(72);
  expect(getAlbumAchievementProgress(achievement, state, cards)).toEqual({ value: 3, target: 3 });
  const mountain = ALBUM_ACHIEVEMENTS.find(row => row.id === "profile-mountain")!;
  expect(getAlbumAchievementProgress(mountain, state, cards).target).toBe(15);
  expect(ALBUM_ACHIEVEMENTS).toHaveLength(19);
});
