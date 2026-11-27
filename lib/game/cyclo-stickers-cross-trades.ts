import type { CollectorAlbumSnapshot } from "./collector-album";
import type { CycloStickersCardReference, CycloStickersCrossTrade, CycloStickersPersistentState,
  CycloStickersSeasonCard, CycloStickersTradeWorkspace } from "./cyclo-stickers-persistence";

export const stickerReferenceKey = (ref: CycloStickersCardReference) => JSON.stringify([ref.editionId, ref.cardNumber]);
export const stickerReference = ({ editionId, cardNumber }: CycloStickersCardReference) => ({ editionId, cardNumber });
export const sortStickerReferences = (refs: readonly CycloStickersCardReference[]) => refs.map(stickerReference)
  .sort((left, right) => left.editionId.localeCompare(right.editionId) || left.cardNumber - right.cardNumber);
export function countStickerReferences(refs: readonly CycloStickersCardReference[], ref: CycloStickersCardReference) {
  const key = stickerReferenceKey(ref);
  return refs.filter(item => stickerReferenceKey(item) === key).length;
}
export function getCrossSeasonReceivedCards(items: readonly CycloStickersSeasonCard[], owned: CycloStickersTradeWorkspace["owned"]) {
  const stock = new Map(owned.map(row => [stickerReferenceKey(row), Math.max(row.quantity, row.pasted ? 1 : 0)]));
  const grouped = new Map<string, CycloStickersSeasonCard & { quantity: number }>();
  for (const item of items) {
    const key = stickerReferenceKey(item);
    const previous = grouped.get(key);
    grouped.set(key, { ...item, quantity: (previous?.quantity ?? 0) + 1 });
  }
  return [...grouped.values()].map(item => {
    const ownedQuantity = stock.get(stickerReferenceKey(item)) ?? 0;
    return { ...item, ownedQuantity, newForCollection: ownedQuantity === 0,
      duplicateQuantity: item.quantity - (ownedQuantity === 0 ? 1 : 0) };
  });
}

/** Read-only first paint for old offers. New actions wait for the global RPC. */
export function legacyTradeWorkspace(snapshot: CollectorAlbumSnapshot, state: CycloStickersPersistentState): CycloStickersTradeWorkspace {
  const ref = (cardNumber: number): CycloStickersSeasonCard => ({ editionId: state.edition.id, sourceSeason: state.edition.sourceSeason, cardNumber });
  const offer = (trade: CycloStickersPersistentState["history"][number]): CycloStickersCrossTrade => ({
    ...trade, legacy: true, editionId: state.edition.id,
    giveItems: trade.give.map(ref), receiveItems: (trade.receiveCards?.length ? trade.receiveCards : [trade.receive]).map(ref),
  });
  const pastedCount = state.owned.filter(row => row.pasted).length;
  return { directorId: state.directorId,
    editions: [{ editionId: state.edition.id, sourceSeasonId: state.edition.sourceSeasonId,
      collectionSeasonId: state.edition.collectionSeasonId, sourceSeason: state.edition.sourceSeason,
      collectionSeason: state.edition.collectionSeason, totalCards: snapshot.cards.length, pastedCount,
      ownedCount: state.owned.filter(row => row.quantity > 0 || row.pasted).length,
      completionPercent: snapshot.cards.length ? Math.round(pastedCount * 100 / snapshot.cards.length) : 0 }],
    owned: state.owned.map(row => ({ ...row, ...ref(row.cardNumber) })),
    incomingOffers: state.incomingOffers.map(offer), outgoingOffers: state.outgoingOffers.map(offer), history: state.history.map(offer),
  };
}

export function isCycloStickersTradeWorkspace(value: unknown, directorId: string): value is CycloStickersTradeWorkspace {
  if (!value || typeof value !== "object") return false;
  const state = value as CycloStickersTradeWorkspace;
  if (state.directorId !== directorId || !Array.isArray(state.editions) || !Array.isArray(state.owned) ||
    !Array.isArray(state.incomingOffers) || !Array.isArray(state.outgoingOffers) || !Array.isArray(state.history)) return false;
  const editions = new Map(state.editions.map(edition => [edition?.editionId, edition?.sourceSeason]));
  if (editions.size !== state.editions.length || state.editions.some(edition => !edition || typeof edition.editionId !== "string" ||
    !Number.isInteger(edition.sourceSeason) || edition.sourceSeason < 1 || edition.collectionSeason !== edition.sourceSeason + 1)) return false;
  const validRef = (ref: CycloStickersSeasonCard) => ref && editions.get(ref.editionId) === ref.sourceSeason &&
    Number.isInteger(ref.cardNumber) && ref.cardNumber > 0;
  if (state.owned.some(row => !validRef(row) || !Number.isInteger(row.quantity) || row.quantity < 0 ||
    !Number.isInteger(row.reserved) || row.reserved < 0 || row.reserved > row.quantity || typeof row.pasted !== "boolean")) return false;
  return [...state.incomingOffers, ...state.outgoingOffers, ...state.history].every(offer => offer && typeof offer.id === "string" &&
    (offer.fromDirectorId === directorId || offer.toDirectorId === directorId) && Array.isArray(offer.giveItems) &&
    offer.giveItems.length >= 1 && offer.giveItems.length <= 3 && offer.giveItems.every(validRef) &&
    Array.isArray(offer.receiveItems) && offer.receiveItems.length >= 1 && offer.receiveItems.length <= 3 && offer.receiveItems.every(validRef));
}
