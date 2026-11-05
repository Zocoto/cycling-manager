import { expect, it } from "vitest";
import { getLooseAlbumCardCount } from "./collector-album";
import { createCycloStickersPersistentStateFixture } from "./cyclo-stickers-persistence.fixture";
import { createCycloStickersTradeRequestIds, getCycloStickersActionRpc, getCycloStickersOpenRpc, toCycloStickersAlbumView } from "./cyclo-stickers-persistent-view";

it("starts with exactly the server inventory and protects all reserved and pasted copies", () => {
  const state = createCycloStickersPersistentStateFixture();
  expect(toCycloStickersAlbumView(state).owned).toEqual([]);
  expect(toCycloStickersAlbumView(state).partners).toEqual({});
  state.owned = [{ cardNumber: 1, quantity: 5, pasted: true, reserved: 3 }, { cardNumber: 69, quantity: 1, pasted: false, reserved: 1 }];
  const view = toCycloStickersAlbumView(state);
  expect(view.owned).toEqual([1, 69]);
  expect(view.ownedQuantities).toEqual({ 1: 5, 69: 1 });
  expect(getLooseAlbumCardCount(view, 1)).toBe(1);
  expect(getLooseAlbumCardCount(view, 69)).toBe(0);
  expect(view.pasted).toEqual([1]);
  state.owned[0].quantity = 1_000_000;
  expect(toCycloStickersAlbumView(state).owned).toHaveLength(2);
});

it("builds opening requests from source and booster id without accepting card numbers or randomness", () => {
  expect(getCycloStickersOpenRpc("s5", "referral", "pack")).toEqual({ rpcName: "open_current_cyclo_stickers_booster", args: { p_edition: "s5", p_inventory_source: "referral", p_booster_id: "pack" } });
  expect(() => getCycloStickersActionRpc("s5", { type: "open-pack", id: "pack", season: 5, cards: [68, 69] })).toThrow();
  expect(() => getCycloStickersActionRpc("s5", { type: "reset" })).toThrow();
  expect(() => getCycloStickersActionRpc("s5", { type: "unpaste", card: 1 })).toThrow();
  expect(getCycloStickersActionRpc("s5", { type: "paste", card: 1 })).toEqual({ rpcName: "paste_current_cyclo_stickers_card", args: { p_edition: "s5", p_card_number: 1 } });
});

it("retries uncertain trade submissions with one ID and gives subsequent intended offers a fresh ID", () => {
  let sequence = 0;
  const requests = createCycloStickersTradeRequestIds(() => String(++sequence));
  const first = requests.forOffer("A:[1]->B:9");
  expect(requests.forOffer("A:[1]->B:9")).toBe(first);
  requests.confirmed(first);
  const next = requests.forOffer("A:[1]->B:9");
  expect(next).not.toBe(first);
  const changed = requests.forOffer("A:[2]->B:9");
  requests.confirmed(next);
  expect(requests.forOffer("A:[2]->B:9")).toBe(changed);
});
