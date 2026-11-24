import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS } from "./discount-recommerce-batch-25";

const EXPECTED_COUNTRIES = ["AO", "BA", "BJ", "BT", "CR", "EE", "GH", "JO", "LK", "MN"];

describe("discount and recommerce sponsor batch 25", () => {
  it("adds ten unique sponsors across ten least-covered countries", () => {
    expect(DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS).toHaveLength(10);
    expect(new Set(DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
    expect(DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("keeps every activity within discount, buyback or recommerce", () => {
    for (const sponsor of DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS) {
      expect(sponsor.sector).toMatch(/discount|rachat|recondition|déstock|seconde main|retours|reprise|occasion/i);
    }
  });

  it("provides three canonical and distinct jersey variants per sponsor", () => {
    for (const sponsor of DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
      expect(sponsor.jerseys.every((jersey) => jersey.imagePath.endsWith(".webp"))).toBe(true);
    }
  });

  it("uses a varied prestige distribution", () => {
    const counts = DISCOUNT_RECOMMERCE_BATCH_25_SPONSORS.reduce<Record<number, number>>((result, sponsor) => {
      result[sponsor.prestige] = (result[sponsor.prestige] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({ 1: 2, 2: 3, 3: 3, 4: 1, 5: 1 });
  });

  it("raises each selected country to four sponsors and the catalog to 630", () => {
    expect(SPONSORS).toHaveLength(630);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(4);
    }
  });
});
