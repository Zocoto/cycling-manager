import { describe, expect, it } from "vitest";
import { parseOpeningBreakdown } from "./federation-treasury";

const legacyOpening = {
  commonGrant: 1_200_000, uciGrant: 1_000_000, nationsCupGrant: 450_000,
  raceRevenue: 0, completedRaceDays: 0, averageStarters: 0,
};

describe("frozen federation opening breakdown", () => {
  it("keeps a historical opening unchanged instead of inventing a ranking premium", () => {
    expect(parseOpeningBreakdown(legacyOpening)).toEqual({ ...legacyOpening, nationsCupBaseGrant: 450_000, nationRankingBonus: 0 });
  });

  it("reads the exact base and premium paid in S4 from ledger metadata", () => {
    const opening = { ...legacyOpening, nationsCupGrant: "768000", nationsCupBaseGrant: "450000", nationRankingBonus: "318000", budgetGameYear: 4 };
    expect(parseOpeningBreakdown(opening)).toEqual({ ...legacyOpening, nationsCupGrant: 768_000, nationsCupBaseGrant: 450_000, nationRankingBonus: 318_000 });
  });

  it("rejects an incomplete opening", () => {
    expect(parseOpeningBreakdown(undefined)).toBeNull();
    expect(parseOpeningBreakdown({ nationsCupGrant: 450_000 })).toBeNull();
  });
});
