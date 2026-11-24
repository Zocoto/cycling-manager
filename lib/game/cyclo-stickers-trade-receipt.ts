import type { CycloStickersPersistentState } from "./cyclo-stickers-persistence";

export type CycloStickersReceivedCard = {
  cardNumber: number;
  quantity: number;
  ownedQuantity: number;
  newForCollection: boolean;
  duplicateQuantity: number;
};

/** Includes pasted copies and spares; reservations do not make a card missing. */
export function getCycloStickersReceivedCards(
  numbers: readonly number[],
  owned: readonly Pick<CycloStickersPersistentState["owned"][number], "cardNumber" | "quantity" | "pasted">[],
): CycloStickersReceivedCard[] {
  const collection = new Map(owned.map(row => [row.cardNumber, Math.max(row.quantity, row.pasted ? 1 : 0)]));
  const incoming = new Map<number, number>();
  for (const number of numbers) incoming.set(number, (incoming.get(number) ?? 0) + 1);

  return [...incoming].map(([cardNumber, quantity]) => {
    const ownedQuantity = collection.get(cardNumber) ?? 0;
    const newForCollection = ownedQuantity === 0;
    return {
      cardNumber,
      quantity,
      ownedQuantity,
      newForCollection,
      duplicateQuantity: quantity - (newForCollection ? 1 : 0),
    };
  });
}
