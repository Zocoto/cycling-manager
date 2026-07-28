import { describe, expect, it } from "vitest";

import { isGameYearCoveredBySponsorContract } from "./team-sponsor-history";

describe("team sponsor history", () => {
  it("keeps an active contract without an end season open", () => {
    expect(
      isGameYearCoveredBySponsorContract({
        gameYear: 3,
        startGameYear: 1,
        endGameYear: null,
      }),
    ).toBe(true);
  });

  it("respects the bounds of a completed sponsor contract", () => {
    expect(
      isGameYearCoveredBySponsorContract({
        gameYear: 3,
        startGameYear: 1,
        endGameYear: 2,
      }),
    ).toBe(false);
  });

  it("rejects an incomplete season reference", () => {
    expect(
      isGameYearCoveredBySponsorContract({
        gameYear: 2,
        startGameYear: 1,
        endGameYear: undefined,
      }),
    ).toBe(false);
  });
});