import { describe, expect, it } from "vitest";

import {
  GAMEPLAY_RULES,
  getSponsoringUnlockProgress,
  isFutureSponsoringWindowOpen,
  isSponsoringUnlocked,
} from "./gameplay-rules";

describe("sponsoring unlock rules", () => {
  it("keeps sponsoring locked below the global threshold", () => {
    expect(
      isSponsoringUnlocked(
        GAMEPLAY_RULES.sponsoringUnlockReputation - 1
      )
    ).toBe(false);
  });

  it("unlocks sponsoring at the global threshold", () => {
    expect(
      isSponsoringUnlocked(
        GAMEPLAY_RULES.sponsoringUnlockReputation
      )
    ).toBe(true);
  });

  it("keeps first sponsor offers closed before day 21", () => {
    expect(
      isFutureSponsoringWindowOpen(
        GAMEPLAY_RULES.futureSponsoringOpeningDay - 1
      )
    ).toBe(false);
  });

  it("opens exactly on day 21 for the next season", () => {
    expect(
      isFutureSponsoringWindowOpen(
        GAMEPLAY_RULES.futureSponsoringOpeningDay
      )
    ).toBe(true);
  });

  it("bounds progress between zero and one hundred", () => {
    expect(getSponsoringUnlockProgress(-10)).toBe(0);
    expect(getSponsoringUnlockProgress(15)).toBe(50);
    expect(getSponsoringUnlockProgress(1000)).toBe(100);
  });
});
