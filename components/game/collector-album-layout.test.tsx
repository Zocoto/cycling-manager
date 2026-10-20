import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import {
  ALBUM_PILOT_EDITION, ALBUM_PILOT_SEASON, ALBUM_PROFILES, albumPilotStorageKey,
  createAlbumPilotState, readAlbumPilotState, updateAlbumPilot,
  type CollectorAlbumSnapshot,
} from "@/lib/game/collector-album";
import { getAlbumProfileCards, getAlbumProfileLeaves } from "@/lib/game/collector-album-layout";
import { CollectorAlbum } from "./collector-album";

const snapshot = raw as CollectorAlbumSnapshot;
const ownerId = "58140add-54c6-40af-9528-f823d0051d0f";

afterEach(() => vi.unstubAllGlobals());

describe("illustrated collector album profile spreads", () => {
  it.each(ALBUM_PROFILES)("server-renders every $label card on its two leaves without four-card pagination", profile => {
    const cards = getAlbumProfileCards(snapshot.cards, profile.id);
    const expectedLeaves = getAlbumProfileLeaves(cards);
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={ownerId} initialProfile={profile.id} />);
    const renderedNumbers = [...html.matchAll(/data-album-slot="(\d+)"/g)].map(match => Number(match[1]));
    expect(renderedNumbers).toEqual(cards.map(card => card.number));
    expect(new Set(renderedNumbers).size).toBe(cards.length);
    expect(html).toContain(`data-profile="${profile.id}"`);
    expect(html.match(/data-album-leaf="[12]"/g)).toHaveLength(2);
    const leftStart = html.indexOf('data-album-leaf="1"');
    const rightStart = html.indexOf('data-album-leaf="2"');
    const footerStart = html.indexOf('aria-label="Catégorie précédente"');
    const leftNumbers = [...html.slice(leftStart, rightStart).matchAll(/data-album-slot="(\d+)"/g)].map(match => Number(match[1]));
    const rightNumbers = [...html.slice(rightStart, footerStart).matchAll(/data-album-slot="(\d+)"/g)].map(match => Number(match[1]));
    expect([leftNumbers, rightNumbers]).toEqual(expectedLeaves.map(leaf => leaf.map(card => card.number)));
    expect(html).toContain("Toute la catégorie sur cette double page");
    expect(html).not.toContain('aria-label="Page précédente"');
    expect(html).not.toContain('aria-label="Page suivante"');
    for (const card of cards) expect(html).toContain(`>${card.name}</h3>`);
  });

  it.each(ALBUM_PROFILES)("keeps chapter navigation bounded for $label", profile => {
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={ownerId} initialProfile={profile.id} />);
    const previous = html.match(/<button[^>]*aria-label="Catégorie précédente"[^>]*>/)?.[0];
    const next = html.match(/<button[^>]*aria-label="Catégorie suivante"[^>]*>/)?.[0];
    expect(previous).toBeTruthy();
    expect(next).toBeTruthy();
    expect(previous?.includes('disabled=""')).toBe(profile.id === "tours");
    expect(next?.includes('disabled=""')).toBe(profile.id === "breakaway");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("keeps the initial server render deterministic, without browser storage or network requests", () => {
    const fetch = vi.fn(() => { throw new Error("The private album must not fetch gameplay data"); });
    vi.stubGlobal("fetch", fetch);
    expect(typeof window).toBe("undefined");
    const first = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={ownerId} />);
    const second = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={ownerId} />);
    expect(first).toBe(second);
    expect(fetch).not.toHaveBeenCalled();
    expect(first).toContain("Ouverture de ton album…");
    expect(first).toContain("Aperçu privé · Abbaye du Lion");
    expect(first).toContain("Les récompenses sont simulées, sans effet sur ton équipe.");
  });

  it("labels the frozen champions as edition S3 without resetting the existing S4 pilot inventory", () => {
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={ownerId} />);
    expect(html).toContain("<strong>S3</strong>");
    expect(html).toContain("Édition saison 3 · Les champions du peloton");
    expect(html).toContain('data-album-cover=""');
    expect(html).toContain("Ouvrir mon album");
    expect(html).not.toContain("data-album-slot=");
    expect(html).not.toContain("ÉDITION S4");
    expect(snapshot.sourceSeason).toBe(3);
    expect(snapshot.collectionSeason).toBe(ALBUM_PILOT_SEASON);
    expect(snapshot.edition).toBe(ALBUM_PILOT_EDITION);
    expect(albumPilotStorageKey(ownerId, snapshot.edition)).toBe(`cs:private-collector:s4-top50-s3-private-v1:${ownerId}`);
    const existing = updateAlbumPilot(createAlbumPilotState(snapshot.collectionSeason), { type: "paste", card: 1 });
    expect(readAlbumPilotState(JSON.stringify(existing), snapshot.collectionSeason)).toEqual(existing);
  });

  it("renders two empty leaves cleanly if a source edition has no cards in a category", () => {
    const emptyProfileSnapshot = { ...snapshot, cards: snapshot.cards.filter(card => card.profileKey !== "breakaway") };
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={emptyProfileSnapshot} storageOwnerId={ownerId} initialProfile="breakaway" />);
    expect(html.match(/data-album-leaf="[12]"/g)).toHaveLength(2);
    expect(html).not.toContain("data-album-slot=");
    expect(html.match(/Les grandes histoires tiennent parfois en une seule vignette\./g)).toHaveLength(2);
    expect(html).not.toContain("NaN");
  });
});
