import { describe, expect, it } from "vitest";

import {
  getFederationJuniorBirthYearRange,
  isFederationJuniorAgeEligible,
} from "@/lib/game/federation-junior-eligibility";

describe("federation junior eligibility", () => {
  it("accepts only riders aged 16 through 18", () => {
    expect(isFederationJuniorAgeEligible({ gameYear: 3, birthGameYear: -12 })).toBe(false);
    expect(isFederationJuniorAgeEligible({ gameYear: 3, birthGameYear: -13 })).toBe(true);
    expect(isFederationJuniorAgeEligible({ gameYear: 3, birthGameYear: -15 })).toBe(true);
    expect(isFederationJuniorAgeEligible({ gameYear: 3, birthGameYear: -16 })).toBe(false);
  });

  it("builds the inclusive birth-year range used by the database query", () => {
    expect(getFederationJuniorBirthYearRange(3)).toEqual({
      minBirthGameYear: -15,
      maxBirthGameYear: -13,
    });
  });
});
