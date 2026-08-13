import { describe, expect, it } from "vitest";

import { SPONSORS } from "@/data/sponsors";

import {
  SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS,
  isSponsorEligibleForReputation,
} from "./sponsor-prestige";

describe("sponsor prestige reputation thresholds", () => {
  it("applique la progression 0 / 30 / 100 / 500 / 1000", () => {
    expect(SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS).toEqual({
      1: 0,
      2: 30,
      3: 100,
      4: 500,
      5: 1_000,
    });
  });

  it("interdit tout sponsor 5/5 avant 1000 de réputation", () => {
    const prestigeFiveSponsors = SPONSORS.filter(
      (sponsor) => sponsor.prestige === 5
    );

    expect(prestigeFiveSponsors.length).toBeGreaterThan(0);
    expect(
      prestigeFiveSponsors.every(
        (sponsor) =>
          !isSponsorEligibleForReputation(sponsor, 999) &&
          isSponsorEligibleForReputation(sponsor, 1_000)
      )
    ).toBe(true);
  });
});