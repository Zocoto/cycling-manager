import { describe, expect, it } from "vitest";
import {
  ALL_TRANSFER_AUCTION_SOURCES,
  getTransferAuctionSource,
} from "./transfer-auction-sources";

describe("origine des offres du bureau des transferts", () => {
  it("active les trois origines par défaut", () => {
    expect(ALL_TRANSFER_AUCTION_SOURCES).toEqual({
      director: true,
      daily: true,
      "national-day": true,
    });
  });

  it.each([
    ["director", false, "director"],
    ["director", true, "director"],
    ["daily", false, "daily"],
    ["daily", true, "national-day"],
  ] as const)("classe %s / bonus %s dans %s", (type, isNationalDayBonus, expected) => {
    expect(getTransferAuctionSource({ type, isNationalDayBonus })).toBe(expected);
  });
});
