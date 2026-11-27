import { describe, expect, it } from "vitest";
import { countStickerReferences, getCrossSeasonReceivedCards, sortStickerReferences, stickerReferenceKey } from "./cyclo-stickers-cross-trades";

const s4 = { editionId: "album-s4", sourceSeason: 4, cardNumber: 1 };
const s5 = { editionId: "album-s5", sourceSeason: 5, cardNumber: 1 };
describe("card identity across seasons", () => {
  it("never merges the same card number from two different collections", () => {
    expect(stickerReferenceKey(s4)).not.toBe(stickerReferenceKey(s5));
    expect(countStickerReferences([s4, s5, s5], s4)).toBe(1);
    expect(countStickerReferences([s4, s5, s5], s5)).toBe(2);
    expect(sortStickerReferences([s5, s4])).toEqual([
      { editionId: "album-s4", cardNumber: 1 }, { editionId: "album-s5", cardNumber: 1 },
    ]);
  });
  it("only warns about doubles in the edition that will actually receive the cards", () => {
    const received = getCrossSeasonReceivedCards([s4, s4, s5], [{ ...s5, quantity: 2, pasted: true, reserved: 1 }]);
    expect(received).toEqual([
      { ...s4, quantity: 2, ownedQuantity: 0, newForCollection: true, duplicateQuantity: 1 },
      { ...s5, quantity: 1, ownedQuantity: 2, newForCollection: false, duplicateQuantity: 1 },
    ]);
  });
});
