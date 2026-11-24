import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-s4-preview.json";
import { createAlbumPilotState, type CollectorAlbumSnapshot } from "./collector-album";
import { getAlbumCardsReadyToPaste } from "./collector-album-paste";

const snapshot = raw as CollectorAlbumSnapshot;

describe("cards ready to paste", () => {
  it("counts each empty slot once and includes introduction stickers", () => {
    const state = createAlbumPilotState(snapshot.collectionSeason, snapshot.cards);
    state.owned = [1, 1, 68];
    state.ownedQuantities = { 1: 3, 68: 1 };
    state.pasted = [];
    state.pending = null;
    expect(getAlbumCardsReadyToPaste(state, snapshot.cards).map(card => card.number)).toEqual([1, 68]);
  });

  it("excludes pasted, reserved and unknown cards while keeping an unreserved copy", () => {
    const state = createAlbumPilotState(snapshot.collectionSeason, snapshot.cards);
    state.owned = [1, 2, 3, 4, 999];
    state.ownedQuantities = { 1: 2, 2: 1, 3: 2, 4: 0, 999: 5 };
    state.pasted = [1];
    state.pending = { give: [2, 3], receive: 5, partnerId: "server-reservations" };
    expect(getAlbumCardsReadyToPaste(state, snapshot.cards).map(card => card.number)).toEqual([3]);
  });

  it("becomes empty after the available sticker is pasted", () => {
    const state = createAlbumPilotState(snapshot.collectionSeason, snapshot.cards);
    state.owned = [1];
    state.ownedQuantities = { 1: 2 };
    state.pasted = [1];
    state.pending = null;
    expect(getAlbumCardsReadyToPaste(state, snapshot.cards)).toEqual([]);
  });
});
