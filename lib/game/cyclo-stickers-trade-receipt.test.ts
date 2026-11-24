import { describe, expect, it } from "vitest";
import { getCycloStickersReceivedCards } from "./cyclo-stickers-trade-receipt";

describe("received Cyclo-Stickers", () => {
  it("identifies pasted cards and unpasted inventory cards as already owned", () => {
    expect(getCycloStickersReceivedCards([1, 2, 3], [
      { cardNumber: 1, quantity: 1, pasted: true },
      { cardNumber: 2, quantity: 2, pasted: false },
    ])).toEqual([
      { cardNumber: 1, quantity: 1, ownedQuantity: 1, newForCollection: false, duplicateQuantity: 1 },
      { cardNumber: 2, quantity: 1, ownedQuantity: 2, newForCollection: false, duplicateQuantity: 1 },
      { cardNumber: 3, quantity: 1, ownedQuantity: 0, newForCollection: true, duplicateQuantity: 0 },
    ]);
  });

  it("counts only the first copy of a missing sticker as new in a multiple-card offer", () => {
    expect(getCycloStickersReceivedCards([4, 4, 5], [])).toEqual([
      { cardNumber: 4, quantity: 2, ownedQuantity: 0, newForCollection: true, duplicateQuantity: 1 },
      { cardNumber: 5, quantity: 1, ownedQuantity: 0, newForCollection: true, duplicateQuantity: 0 },
    ]);
    expect(getCycloStickersReceivedCards([4, 4, 4], [{ cardNumber: 4, quantity: 1, pasted: true }])[0].duplicateQuantity).toBe(3);
  });

  it("uses current collection state rather than the state when the offer was sent", () => {
    expect(getCycloStickersReceivedCards([7], [])[0].newForCollection).toBe(true);
    expect(getCycloStickersReceivedCards([7], [{ cardNumber: 7, quantity: 1, pasted: false }])[0].duplicateQuantity).toBe(1);
    expect(getCycloStickersReceivedCards([7], [{ cardNumber: 7, quantity: 0, pasted: false }])[0].newForCollection).toBe(true);
    expect(getCycloStickersReceivedCards([7], [{ cardNumber: 7, quantity: 0, pasted: true }])[0].newForCollection).toBe(false);
  });
});
