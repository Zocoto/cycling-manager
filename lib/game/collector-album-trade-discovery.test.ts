import { describe, expect, it } from "vitest";
import { canOfferAlbumCards, createAlbumPilotState } from "./collector-album";
import { getAlbumDuplicateCards, getAlbumTradeMatches } from "./collector-album-trade-discovery";

const cards = Array.from({ length: 50 }, (_, index) => ({ number: index + 1 }));

describe("private album reciprocal trade discovery", () => {
  it("never suggests the unique loose starter cards", () => {
    const state = createAlbumPilotState();
    expect(getAlbumDuplicateCards(state)).toEqual([]);
    expect(getAlbumTradeMatches(state, cards, [9])).toEqual([]);
  });

  it("uses a free duplicate while preserving the pasted copy", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8], pasted: [8] };
    const matches = getAlbumTradeMatches(state, cards);
    expect(getAlbumDuplicateCards(state)).toEqual([8]);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(match => match.give === 8 && !state.owned.includes(match.receive))).toBe(true);
    expect(matches.every(match => canOfferAlbumCards(state, { ...match, give: [match.give] }))).toBe(true);
  });

  it("does not offer reserved copies or keep discovering during a pending offer", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8], pending: { give: [8], receive: 9, partnerId: "collector-demo" } };
    expect(getAlbumDuplicateCards(state)).toEqual([]);
    expect(getAlbumTradeMatches(state, cards)).toEqual([]);
  });

  it("prefers a duplicate absent from the receiving collector instead of a copy they already own", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 1, 8, 8], partners: { "collector-demo": [1, 9], "collector-cols": [12, 27], "collector-sprints": [9, 42] } };
    const match = getAlbumTradeMatches(state, cards).find(item => item.partnerId === "collector-demo");
    expect(match).toMatchObject({ receive: 9, give: 8, reciprocal: true });
  });

  it("prioritises the wanted list and ignores owned, invalid and repeated wishlist numbers", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8] };
    const matches = getAlbumTradeMatches(state, cards, [42, 42, 8, 999]);
    expect(matches[0].receive).toBe(42);
    expect(matches.filter(item => item.receive === 42)).toHaveLength(1);
    expect(matches.some(item => item.receive === 8 || item.receive === 999)).toBe(false);
  });

  it("still shows a non-reciprocal possibility when every free duplicate is already known by that collector", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8], partners: { "collector-demo": [8, 9], "collector-cols": [8, 12], "collector-sprints": [8, 42] } };
    const matches = getAlbumTradeMatches(state, cards);
    expect(matches).toHaveLength(3);
    expect(matches.every(item => item.give === 8 && !item.reciprocal)).toBe(true);
  });

  it("only uses the current snapshot and neither mutates inventories nor creates a proposal", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8] };
    const before = JSON.stringify(state);
    expect(getAlbumTradeMatches(state, [{ number: 8 }, { number: 42 }], [42])).toEqual([{ receive: 42, give: 8, partnerId: "collector-sprints", reciprocal: true }]);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.pending).toBeNull();
  });
});
