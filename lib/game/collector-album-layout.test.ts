import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { ALBUM_PROFILES, getCardRarity, type CollectorAlbumSnapshot } from "./collector-album";
import { getAdjacentAlbumProfile, getAlbumProfileCards, getAlbumProfileLeaves } from "./collector-album-layout";

const snapshot = raw as CollectorAlbumSnapshot;

describe("complete collector album profile chapters", () => {
  it("partitions every frozen card into exactly one ordered chapter", () => {
    const expectedCounts = [8, 6, 19, 9, 5, 2, 1];
    const chapters = ALBUM_PROFILES.map(profile => getAlbumProfileCards(snapshot.cards, profile.id));
    expect(chapters.map(cards => cards.length)).toEqual(expectedCounts);
    const allCards = chapters.flat();
    expect(allCards).toHaveLength(50);
    expect(new Set(allCards.map(card => card.id)).size).toBe(50);
    expect(new Set(allCards.map(card => card.number)).size).toBe(50);
    expect(allCards.map(card => card.id).sort()).toEqual(snapshot.cards.map(card => card.id).sort());
    for (const [index, chapter] of chapters.entries()) {
      expect(chapter).toEqual(snapshot.cards.filter(card => card.profileKey === ALBUM_PROFILES[index].id));
      expect(chapter.every(card => snapshot.cards.includes(card))).toBe(true);
    }
  });

  it("splits each entire chapter into balanced leaves, including the 19 puncheurs", () => {
    for (const profile of ALBUM_PROFILES) {
      const cards = getAlbumProfileCards(snapshot.cards, profile.id);
      const [left, right] = getAlbumProfileLeaves(cards);
      expect(left).toHaveLength(Math.ceil(cards.length / 2));
      expect(right).toHaveLength(Math.floor(cards.length / 2));
      expect([...left, ...right]).toEqual(cards);
      expect(new Set([...left, ...right].map(card => card.id)).size).toBe(cards.length);
    }
    expect(getAlbumProfileLeaves(getAlbumProfileCards(snapshot.cards, "hills")).map(leaf => leaf.length)).toEqual([10, 9]);
  });

  it("accepts readonly inputs and returns fresh arrays without mutating card values", () => {
    const cards = Object.freeze(snapshot.cards.map(card => Object.freeze({ ...card })));
    const before = JSON.stringify(cards);
    const selected = getAlbumProfileCards(cards, "tours");
    const [left, right] = getAlbumProfileLeaves(Object.freeze(selected));
    expect(selected).not.toBe(cards);
    expect(left).not.toBe(selected);
    expect(right).not.toBe(selected);
    expect(left).not.toBe(right);
    expect(left[0]).toBe(selected[0]);
    left.pop();
    right.reverse();
    expect(JSON.stringify(cards)).toBe(before);
    expect(selected).toEqual(cards.filter(card => card.profileKey === "tours"));
  });

  it("returns two independent empty leaves for every empty profile", () => {
    for (const profile of ALBUM_PROFILES) {
      const cards = getAlbumProfileCards(Object.freeze([]), profile.id);
      const [left, right] = getAlbumProfileLeaves(cards);
      expect(cards).toEqual([]);
      expect([left, right]).toEqual([[], []]);
      expect(left).not.toBe(right);
      expect(left).not.toBe(cards);
      expect(right).not.toBe(cards);
    }
  });

  it("never sorts by rarity or changes the frozen rarity and native ratings", () => {
    const before = JSON.stringify(snapshot);
    const rarityCounts = { gold: 0, silver: 0, bronze: 0 };
    for (const profile of ALBUM_PROFILES) {
      const chapter = getAlbumProfileCards(snapshot.cards, profile.id);
      for (const card of getAlbumProfileLeaves(chapter).flat()) {
        rarityCounts[getCardRarity(card.rank)]++;
        expect(card).toBe(snapshot.cards.find(source => source.id === card.id));
      }
    }
    expect(rarityCounts).toEqual({ gold: 5, silver: 15, bronze: 30 });
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("turns through all seven categories in their established order and stops at either edge", () => {
    for (const [index, profile] of ALBUM_PROFILES.entries()) {
      expect(getAdjacentAlbumProfile(profile.id, -1)).toBe(ALBUM_PROFILES[Math.max(0, index - 1)].id);
      expect(getAdjacentAlbumProfile(profile.id, 1)).toBe(ALBUM_PROFILES[Math.min(ALBUM_PROFILES.length - 1, index + 1)].id);
    }
    let profile = ALBUM_PROFILES[0].id as typeof ALBUM_PROFILES[number]["id"];
    const visited = [profile];
    for (let index = 1; index < ALBUM_PROFILES.length; index++) {
      profile = getAdjacentAlbumProfile(profile, 1);
      visited.push(profile);
    }
    expect(visited).toEqual(ALBUM_PROFILES.map(entry => entry.id));
    expect(getAdjacentAlbumProfile("breakaway", 1)).toBe("breakaway");
    expect(getAdjacentAlbumProfile("tours", -1)).toBe("tours");
  });
});
