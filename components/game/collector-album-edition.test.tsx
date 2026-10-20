import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import {
  ALBUM_PILOT_EDITION, ALBUM_PILOT_SEASON, albumPilotStorageKey,
  createAlbumPilotState, getAlbumPilotPacks, readAlbumPilotState, updateAlbumPilot,
  type CollectorAlbumSnapshot,
} from "@/lib/game/collector-album";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { CollectorAlbumAchievements } from "./collector-album-achievements";
import { CollectorAlbumBoosters } from "./collector-album-boosters";
import { CollectorAlbumInventoryPreview } from "./collector-album-inventory-preview";
import { CollectorAlbumTradeDesk } from "./collector-album-trades";

const snapshot = raw as CollectorAlbumSnapshot;
const onAction = () => {};

describe("source-season collector edition labels", () => {
  it("prints source season S3 on the wrapper, booth and accessible pack labels", () => {
    const artwork = renderToStaticMarkup(<AlbumBoosterArtwork sourceSeason={snapshot.sourceSeason} />);
    expect(artwork).toContain("ÉDITION <b>S3</b>");
    expect(artwork).toContain('aria-label="Sachet fermé de deux cartes, édition saison 3"');
    const booth = renderToStaticMarkup(<CollectorAlbumBoosters state={createAlbumPilotState()} snapshot={snapshot} ready onAction={onAction} onViewAlbum={() => {}} />);
    expect(booth).toContain("LE KIOSQUE DU COLLECTIONNEUR · ÉDITION S3");
    expect(booth).toContain('aria-label="Ouvrir le sachet de test 1, édition saison 3"');
    expect(booth).not.toContain("S4");
  });

  it("prints S3 on the achievement cabinet, numbered trophy and trade letter", () => {
    const state = createAlbumPilotState();
    const achievements = renderToStaticMarkup(<CollectorAlbumAchievements state={state} snapshot={snapshot} ready onAction={onAction} />);
    expect(achievements).toContain("LE LIVRE D’OR · SAISON 3");
    expect(achievements).toContain("MÉMOIRE DU PELOTON · S3");
    expect(achievements).not.toContain("SAISON 4");
    const pending = updateAlbumPilot(state, {type:"propose", give:8, receive:9});
    const trade = renderToStaticMarkup(<CollectorAlbumTradeDesk state={pending} snapshot={snapshot} ready onAction={onAction} />);
    expect(trade).toContain("Objet : une proposition pour ta collection · Édition S3");
    expect(trade).not.toContain("Édition S4");
  });

  it("links the inventory preview to the canonical S3 edition", () => {
    const inventory = renderToStaticMarkup(<CollectorAlbumInventoryPreview storageOwnerId="private-owner" />);
    expect(inventory).toContain("Les sachets du peloton · Édition S3");
    expect(inventory).toContain('href="/jeu/album?saison=3&amp;onglet=boosters"');
    expect(inventory).not.toContain("S4");
  });

  it("preserves deployed pack receipts, claims, exchanges and storage identity when labels become S3", () => {
    const pack = getAlbumPilotPacks()[0];
    let state = createAlbumPilotState(snapshot.collectionSeason);
    state = updateAlbumPilot(state, {type:"open-pack", id:pack.id, season:snapshot.collectionSeason, cards:[21,22]});
    state = updateAlbumPilot(state, {type:"paste", card:1});
    state = updateAlbumPilot(state, {type:"claim-achievement", id:"count-1"}, snapshot.cards);
    state = updateAlbumPilot(state, {type:"propose", give:8, receive:9});
    state = updateAlbumPilot(state, {type:"accept"});
    const persisted = JSON.stringify(state);
    renderToStaticMarkup(<CollectorAlbumBoosters state={state} snapshot={snapshot} ready onAction={onAction} onViewAlbum={() => {}} />);
    const restored = readAlbumPilotState(persisted, snapshot.collectionSeason);
    expect(restored).toEqual(state);
    expect(restored.season).toBe(ALBUM_PILOT_SEASON);
    expect(restored.openedPacks[0].id).toBe("s4-sample-1");
    expect(restored.claimedAchievements).toEqual(["count-1"]);
    expect(restored.acceptedTradeCount).toBe(1);
    expect(updateAlbumPilot(restored, {type:"open-pack", id:pack.id, season:ALBUM_PILOT_SEASON, cards:[1,2]})).toBe(restored);
    expect(albumPilotStorageKey("private-owner", snapshot.edition)).toBe(`cs:private-collector:${ALBUM_PILOT_EDITION}:private-owner`);
    expect(snapshot.edition).toBe("s4-top50-s3-private-v1");
  });
});
