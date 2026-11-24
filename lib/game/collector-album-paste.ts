import { getLooseAlbumCardCount, type AlbumPilotState, type CollectorCard } from "./collector-album";

/** One entry per empty slot, only when a non-reserved copy can fill it. */
export function getAlbumCardsReadyToPaste(state: AlbumPilotState, cards: readonly CollectorCard[]) {
  const pasted = new Set(state.pasted);
  return cards.filter(card => !pasted.has(card.number) && getLooseAlbumCardCount(state, card.number) > 0);
}
