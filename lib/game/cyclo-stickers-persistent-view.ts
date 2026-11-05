import type { AlbumPilotAction, AlbumPilotState } from "./collector-album";
import type { CycloStickersInventorySource, CycloStickersPersistentState } from "./cyclo-stickers-persistence";

/** A view of authoritative quantities, never a migration of the browser demonstration. */
export function toCycloStickersAlbumView(state: CycloStickersPersistentState): AlbumPilotState {
  const reserved = state.owned.flatMap(row => Array.from({ length: row.reserved }, () => row.cardNumber));
  return {
    version: 3, season: state.edition.collectionSeason,
    owned: state.owned.filter(row => row.quantity > 0).map(row => row.cardNumber),
    ownedQuantities: Object.fromEntries(state.owned.map(row => [row.cardNumber, row.quantity])),
    pasted: state.owned.filter(row => row.pasted).map(row => row.cardNumber), partners: {},
    // The book's existing availability helper subtracts each reserved copy.
    // Actual offers and participants are rendered from the server trade records.
    pending: reserved.length ? { give: reserved, receive: 0, partnerId: "server-reservations" } : null,
    history: [], openedPacks: state.openedPacks.map(row => ({ id: `${row.inventorySource}:${row.id}`, cards: row.cards })),
    claimedAchievements: state.claimedAchievements, acceptedTradeCount: state.acceptedTradeCount,
  };
}

export function getCycloStickersActionRpc(edition: string, action: AlbumPilotAction) {
  if (action.type === "paste") return { rpcName: "paste_current_cyclo_stickers_card", args: { p_edition: edition, p_card_number: action.card } };
  if (action.type === "claim-achievement") return { rpcName: "claim_current_cyclo_stickers_achievement", args: { p_edition: edition, p_achievement_id: action.id } };
  throw new Error("Cette action appartient uniquement à l’aperçu privé.");
}

/** Drawn card numbers and randomness are never accepted from a client action. */
export function getCycloStickersOpenRpc(edition: string, inventorySource: CycloStickersInventorySource, boosterId: string) {
  return { rpcName: "open_current_cyclo_stickers_booster", args: { p_edition: edition, p_inventory_source: inventorySource, p_booster_id: boosterId } };
}

/** Retain an uncertain submission's ID; a later deliberate offer must get a new ID. */
export function createCycloStickersTradeRequestIds(generateId: () => string = () => globalThis.crypto.randomUUID()) {
  let pending: { signature: string; id: string } | null = null;
  return {
    forOffer(signature: string) {
      if (pending?.signature !== signature) pending = { signature, id: generateId() };
      return pending.id;
    },
    confirmed(id: string) { if (pending?.id === id) pending = null; },
  };
}
