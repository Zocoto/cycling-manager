import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { ALBUM_PROFILES, type CollectorAlbumSnapshot } from "./collector-album";
import { getAlbumProfileCards, getAlbumProfileLeaves } from "./collector-album-layout";
import { getAlbumPageTurn, getAlbumSwipeDirection, type AlbumPagePosition } from "./collector-album-navigation";

const cards = (raw as CollectorAlbumSnapshot).cards;

function traverse(start: AlbumPagePosition, singlePage: boolean, direction: -1 | 1) {
  const positions = [start];
  for (let index = 0; index < 30; index++) {
    const previous = positions.at(-1)!;
    const next = getAlbumPageTurn(cards, previous.profile, previous.leaf, singlePage, direction);
    if (!next) return positions;
    positions.push(next);
  }
  throw new Error("Album navigation must stop instead of looping");
}

describe("collector album page turning", () => {
  it("visits exactly 13 nonempty mobile leaves in the seven canonical categories", () => {
    const expected = ALBUM_PROFILES.flatMap(profile => getAlbumProfileLeaves(getAlbumProfileCards(cards, profile.id))
      .flatMap((leaf, index) => leaf.length ? [{ profile: profile.id, leaf: index + 1 as 1 | 2 }] : []));
    const forward = traverse({ profile: "tours", leaf: 1 }, true, 1);
    expect(forward).toEqual(expected);
    expect(forward).toHaveLength(13);
    expect(new Set(forward.map(page => page.profile)).size).toBe(7);
    expect(forward.at(-1)).toEqual({ profile: "breakaway", leaf: 1 });
  });

  it("returns over exactly the same mobile leaves in reverse order", () => {
    const forward = traverse({ profile: "tours", leaf: 1 }, true, 1);
    const backward = traverse({ profile: "breakaway", leaf: 1 }, true, -1);
    expect(backward).toEqual([...forward].reverse());
    for (let index = 1; index < forward.length; index++) {
      const position = forward[index];
      expect(getAlbumPageTurn(cards, position.profile, position.leaf, true, -1)).toEqual(forward[index - 1]);
    }
  });

  it("keeps every frozen card reachable exactly once on mobile", () => {
    const visited = traverse({ profile: "tours", leaf: 1 }, true, 1);
    const visibleCards = visited.flatMap(position => getAlbumProfileLeaves(getAlbumProfileCards(cards, position.profile))[position.leaf - 1]);
    expect(visibleCards).toHaveLength(50);
    expect(new Set(visibleCards.map(card => card.number)).size).toBe(50);
    expect(visibleCards.map(card => card.id).sort()).toEqual(cards.map(card => card.id).sort());
    expect(visited.filter(position => position.profile === "hills").map(position => getAlbumProfileLeaves(getAlbumProfileCards(cards, position.profile))[position.leaf - 1].length)).toEqual([10, 9]);
  });

  it("turns within the current mobile category before entering the next", () => {
    expect(getAlbumPageTurn(cards, "tours", 1, true, 1)).toEqual({ profile: "tours", leaf: 2 });
    expect(getAlbumPageTurn(cards, "tours", 2, true, 1)).toEqual({ profile: "mountain", leaf: 1 });
    expect(getAlbumPageTurn(cards, "mountain", 1, true, -1)).toEqual({ profile: "tours", leaf: 2 });
    expect(getAlbumPageTurn(cards, "mountain", 2, true, -1)).toEqual({ profile: "mountain", leaf: 1 });
  });

  it("skips an empty right leaf for a one-card chapter in both directions", () => {
    const sparse = cards.filter(card => card.profileKey !== "mountain" || card === cards.find(candidate => candidate.profileKey === "mountain"));
    expect(getAlbumProfileCards(sparse, "mountain")).toHaveLength(1);
    expect(getAlbumPageTurn(sparse, "mountain", 1, true, 1)).toEqual({ profile: "hills", leaf: 1 });
    expect(getAlbumPageTurn(sparse, "hills", 1, true, -1)).toEqual({ profile: "mountain", leaf: 1 });
  });

  it("stops at both mobile and desktop edges without wrapping", () => {
    expect(getAlbumPageTurn(cards, "tours", 1, true, -1)).toBeNull();
    expect(getAlbumPageTurn(cards, "breakaway", 1, true, 1)).toBeNull();
    expect(getAlbumPageTurn(cards, "tours", 1, false, -1)).toBeNull();
    expect(getAlbumPageTurn(cards, "breakaway", 1, false, 1)).toBeNull();
  });

  it("visits all seven desktop spreads and returns without losing any cards", () => {
    const forward = traverse({ profile: "tours", leaf: 1 }, false, 1);
    expect(forward).toEqual(ALBUM_PROFILES.map(profile => ({ profile: profile.id, leaf: 1 })));
    expect(traverse({ profile: "breakaway", leaf: 1 }, false, -1)).toEqual([...forward].reverse());
    const visibleCards = forward.flatMap(position => getAlbumProfileCards(cards, position.profile));
    expect(visibleCards).toHaveLength(50);
    expect(new Set(visibleCards.map(card => card.id)).size).toBe(50);
    // Switching from a mobile right leaf to desktop never leaves a spread half-hidden.
    expect(getAlbumPageTurn(cards, "mountain", 2, false, 1)).toEqual({ profile: "hills", leaf: 1 });
    expect(getAlbumPageTurn(cards, "mountain", 2, false, -1)).toEqual({ profile: "tours", leaf: 1 });
  });

  it("accepts readonly catalogue inputs and never mutates frozen cards", () => {
    const frozen = Object.freeze(cards.map(card => Object.freeze({ ...card })));
    const before = JSON.stringify(frozen);
    expect(getAlbumPageTurn(frozen, "hills", 1, true, 1)).toEqual({ profile: "hills", leaf: 2 });
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

describe("collector album horizontal touch gestures", () => {
  it("turns forward for a left swipe and backward for a right swipe", () => {
    expect(getAlbumSwipeDirection(-120, 5)).toBe(1);
    expect(getAlbumSwipeDirection(120, -5)).toBe(-1);
    expect(getAlbumSwipeDirection(-80, 40)).toBe(1);
    expect(getAlbumSwipeDirection(80, -40)).toBe(-1);
  });

  it("ignores vertical scrolls, diagonals and short movement", () => {
    for (const [dx, dy] of [[0, 150], [40, 0], [-79.99, 0], [120, 61], [-120, -61], [200, 200], [0, 0]]) {
      expect(getAlbumSwipeDirection(dx, dy)).toBeNull();
    }
  });

  it("ignores nonfinite pointer deltas defensively", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(getAlbumSwipeDirection(value, 0)).toBeNull();
      expect(getAlbumSwipeDirection(-120, value)).toBeNull();
    }
  });
});
