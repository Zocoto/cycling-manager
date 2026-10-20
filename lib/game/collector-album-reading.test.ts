import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { ALBUM_PROFILES, albumPilotStorageKey, type CollectorAlbumSnapshot, type CollectorCard } from "./collector-album";
import { albumReadingStorageKey, createAlbumReadingState, getNextAlbumChapter, readAlbumReadingState, updateAlbumReading } from "./collector-album-reading";

const cards = (raw as CollectorAlbumSnapshot).cards;
const firstDate = "2026-10-20T12:00:00.000Z";
const laterDate = "2026-10-21T12:30:00.000Z";
const numbersFor = (profile: typeof ALBUM_PROFILES[number]["id"]) => cards.filter(card => card.profileKey === profile).map(card => card.number);

describe("collector album reading preferences", () => {
  it("starts on a closed cover without creating a false historical date", () => {
    const state = createAlbumReadingState();
    expect(state).toEqual({ version: 1, lastProfile: null, wanted: [], completedChapters: {}, completedAt: null });
    expect(createAlbumReadingState().wanted).not.toBe(state.wanted);
    expect(createAlbumReadingState().completedChapters).not.toBe(state.completedChapters);
  });

  it("has its own storage key without changing the existing pilot inventory key", () => {
    const stockKey = albumPilotStorageKey("owner", "edition");
    expect(albumReadingStorageKey("owner", "edition")).toBe(`${stockKey}:reading-v1`);
    expect(albumReadingStorageKey("owner", "edition")).not.toBe(stockKey);
    expect(albumReadingStorageKey("other", "edition")).not.toBe(albumReadingStorageKey("owner", "edition"));
  });

  it("remembers a chapter or the cover and does not modify an unchanged preference", () => {
    const initial = createAlbumReadingState();
    const open = updateAlbumReading(initial, { type: "profile", profile: "hills" });
    expect(open.lastProfile).toBe("hills");
    expect(initial.lastProfile).toBeNull();
    expect(updateAlbumReading(open, { type: "profile", profile: "hills" })).toBe(open);
    expect(updateAlbumReading(open, { type: "profile", profile: null }).lastProfile).toBeNull();
    expect(updateAlbumReading(open, { type: "profile", profile: "invalid" as "hills" })).toBe(open);
  });

  it("toggles only actual catalogue numbers in a separate wanted list", () => {
    const initial = createAlbumReadingState();
    const wanted = updateAlbumReading(initial, { type: "wanted", card: cards[0].number }, cards);
    expect(wanted.wanted).toEqual([cards[0].number]);
    expect(initial.wanted).toEqual([]);
    expect(updateAlbumReading(wanted, { type: "wanted", card: cards[0].number }, cards).wanted).toEqual([]);
    for (const number of [-1, 0, 999, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(updateAlbumReading(wanted, { type: "wanted", card: number }, cards)).toBe(wanted);
    }
    expect(updateAlbumReading(wanted, { type: "wanted", card: cards[1].number })).toBe(wanted);
  });

  it("round trips valid reading history without sharing mutable arrays or objects", () => {
    const complete = updateAlbumReading(createAlbumReadingState(), { type: "observe-completion", cards, pasted: cards.map(card => card.number), at: firstDate });
    const state = { ...complete, lastProfile: "hills" as const, wanted: [cards[1].number] };
    const loaded = readAlbumReadingState(JSON.stringify(state), cards);
    expect(loaded).toEqual(state);
    expect(loaded.wanted).not.toBe(state.wanted);
    expect(loaded.completedChapters).not.toBe(state.completedChapters);
  });

  it("does not invent or migrate completion history from unrelated storage", () => {
    expect(readAlbumReadingState(null, cards)).toEqual(createAlbumReadingState());
    expect(readAlbumReadingState("{", cards)).toEqual(createAlbumReadingState());
    expect(readAlbumReadingState(JSON.stringify({ version: 3, owned: [1], pasted: [1] }), cards)).toEqual(createAlbumReadingState());
    expect(readAlbumReadingState(" ".repeat(16001), cards)).toEqual(createAlbumReadingState());
  });

  it("rejects malformed fields, unknown cards, duplicate wishes, extra properties and profiles", () => {
    const invalid = [
      { version: 2 },
      { lastProfile: "unknown" },
      { wanted: [999] },
      { wanted: [cards[0].number, cards[0].number] },
      { wanted: [String(cards[0].number)] },
      { wanted: null },
      { completedChapters: [] },
      { completedChapters: { unknown: firstDate } },
      { completedChapters: { hills: null } },
      { extra: true },
    ];
    for (const value of invalid) {
      expect(readAlbumReadingState(JSON.stringify({ ...createAlbumReadingState(), ...value }), cards)).toEqual(createAlbumReadingState());
    }
    const withoutVersion = { lastProfile: null, wanted: [], completedChapters: {}, completedAt: null };
    expect(readAlbumReadingState(JSON.stringify(withoutVersion), cards)).toEqual(createAlbumReadingState());
  });

  it("rejects invalid calendars and noncanonical or missing ISO instants", () => {
    for (const at of ["2026-02-30T12:00:00.000Z", "2026-10-20", "2026-10-20T12:00:00Z", "2026-10-20T14:00:00.000+02:00", "tomorrow", "", 0]) {
      expect(readAlbumReadingState(JSON.stringify({ ...createAlbumReadingState(), completedChapters: { hills: at } }), cards)).toEqual(createAlbumReadingState());
      const state = createAlbumReadingState();
      expect(updateAlbumReading(state, { type: "observe-completion", cards, pasted: cards.map(card => card.number), at: at as string })).toBe(state);
    }
  });

  it("requires a complete chapter history before accepting an album completion stamp", () => {
    expect(readAlbumReadingState(JSON.stringify({ ...createAlbumReadingState(), completedAt: firstDate }), cards)).toEqual(createAlbumReadingState());
    const complete = updateAlbumReading(createAlbumReadingState(), { type: "observe-completion", cards, pasted: cards.map(card => card.number), at: laterDate });
    expect(readAlbumReadingState(JSON.stringify({ ...complete, completedAt: firstDate }), cards)).toEqual(createAlbumReadingState());
    expect(readAlbumReadingState(JSON.stringify({ ...createAlbumReadingState(), completedChapters: { hills: firstDate } }), [])).toEqual(createAlbumReadingState());
  });
});

describe("collector album completion history", () => {
  it("stamps a nonempty chapter only when every one of its cards has been pasted", () => {
    const chapter = numbersFor("timeTrial");
    const initial = createAlbumReadingState();
    expect(updateAlbumReading(initial, { type: "observe-completion", cards, pasted: chapter.slice(1), at: firstDate })).toBe(initial);
    const complete = updateAlbumReading(initial, { type: "observe-completion", cards, pasted: chapter, at: firstDate });
    expect(complete.completedChapters).toEqual({ timeTrial: firstDate });
    expect(complete.completedAt).toBeNull();
    expect(initial.completedChapters).toEqual({});
  });

  it("ignores duplicate pasted numbers and unrelated numbers", () => {
    const number = numbersFor("timeTrial")[0];
    const initial = createAlbumReadingState();
    expect(updateAlbumReading(initial, { type: "observe-completion", cards, pasted: [number, number, 999], at: firstDate })).toBe(initial);
  });

  it("preserves the first completion date after rechecking, unpasting or completing again", () => {
    const initial = createAlbumReadingState();
    const complete = updateAlbumReading(initial, { type: "observe-completion", cards, pasted: numbersFor("timeTrial"), at: firstDate });
    expect(updateAlbumReading(complete, { type: "observe-completion", cards, pasted: [], at: laterDate })).toBe(complete);
    expect(updateAlbumReading(complete, { type: "observe-completion", cards, pasted: numbersFor("timeTrial"), at: laterDate })).toBe(complete);
    const loaded = readAlbumReadingState(JSON.stringify(complete), cards);
    expect(loaded.completedChapters.timeTrial).toBe(firstDate);
  });

  it("records later chapters and album completion without replacing previous stamps", () => {
    const state = updateAlbumReading(createAlbumReadingState(), { type: "observe-completion", cards, pasted: numbersFor("timeTrial"), at: firstDate });
    const complete = updateAlbumReading(state, { type: "observe-completion", cards, pasted: cards.map(card => card.number), at: laterDate });
    expect(complete.completedAt).toBe(laterDate);
    expect(complete.completedChapters.timeTrial).toBe(firstDate);
    expect(Object.keys(complete.completedChapters)).toHaveLength(ALBUM_PROFILES.length);
    expect(updateAlbumReading(complete, { type: "observe-completion", cards, pasted: [], at: laterDate })).toBe(complete);
  });

  it("never dates a new completion before an existing historical date", () => {
    const state = updateAlbumReading(createAlbumReadingState(), { type: "observe-completion", cards, pasted: numbersFor("timeTrial"), at: laterDate });
    expect(updateAlbumReading(state, { type: "observe-completion", cards, pasted: cards.map(card => card.number), at: firstDate })).toBe(state);
  });

  it("never marks empty albums or absent profiles complete", () => {
    const initial = createAlbumReadingState();
    expect(updateAlbumReading(initial, { type: "observe-completion", cards: [], pasted: [], at: firstDate })).toBe(initial);
    const small = cards.filter(card => card.profileKey === "timeTrial");
    const state = updateAlbumReading(initial, { type: "observe-completion", cards: small, pasted: small.map(card => card.number), at: firstDate });
    expect(state.completedChapters).toEqual({ timeTrial: firstDate });
    expect(state.completedAt).toBe(firstDate);
  });
});

describe("next collector album milestone", () => {
  it("suggests the nonempty incomplete chapter needing the fewest cards", () => {
    expect(getNextAlbumChapter(cards, [])).toEqual({ profile: "breakaway", missing: 1, total: 1, pasted: 0 });
    expect(getNextAlbumChapter(cards, numbersFor("breakaway"))).toEqual({ profile: "timeTrial", missing: 2, total: 2, pasted: 0 });
    const pasted = [...numbersFor("hills").slice(1), ...numbersFor("breakaway")];
    expect(getNextAlbumChapter(cards, pasted)).toEqual({ profile: "hills", missing: 1, total: 19, pasted: 18 });
  });

  it("breaks equal missing counts by completion proportion then canonical chapter order", () => {
    const pasted = ALBUM_PROFILES.flatMap(profile => numbersFor(profile.id).slice(1));
    expect(getNextAlbumChapter(cards, pasted)?.profile).toBe("hills");
    const equalSize = [
      { ...cards[0], number: 1, profileKey: "mountain" },
      { ...cards[1], number: 2, profileKey: "tours" },
    ] as CollectorCard[];
    expect(getNextAlbumChapter(equalSize, [])?.profile).toBe("tours");
  });

  it("returns null when there is no unfinished nonempty chapter", () => {
    expect(getNextAlbumChapter([], [])).toBeNull();
    expect(getNextAlbumChapter(cards, cards.map(card => card.number))).toBeNull();
  });

  it("accepts readonly frozen inputs and does not double count pasted numbers", () => {
    const catalog = Object.freeze(cards.map(card => Object.freeze({ ...card })));
    const pasted = Object.freeze([...numbersFor("breakaway"), ...numbersFor("breakaway"), 999]);
    const before = JSON.stringify([catalog, pasted]);
    expect(getNextAlbumChapter(catalog, pasted)).toEqual({ profile: "timeTrial", missing: 2, total: 2, pasted: 0 });
    expect(JSON.stringify([catalog, pasted])).toBe(before);
  });
});
