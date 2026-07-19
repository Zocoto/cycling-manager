import { describe, expect, it } from "vitest";

import {
  GAMEPLAY_RULES,
  getSponsoringUnlockProgress,
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

  it("bounds progress between zero and one hundred", () => {
    expect(getSponsoringUnlockProgress(-10)).toBe(0);
    expect(getSponsoringUnlockProgress(15)).toBe(50);
    expect(getSponsoringUnlockProgress(1000)).toBe(100);
  });
});
