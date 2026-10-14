import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS } from "./undercovered-country-batch-07";

const EXPECTED_COUNTRIES = ["AZ", "BB", "BI", "BJ", "BZ", "CD", "CI", "KH", "MW", "WS"];
const EXPECTED_PRESTIGE = [1, 1, 2, 2, 2, 3, 3, 3, 4, 5];

describe("undercovered country sponsor batch 07", () => {
  it("adds ten distinct sponsors for ten previously undercovered countries", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS).toHaveLength(10);
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS]
        .map((sponsor) => sponsor.countryCode)
        .sort()
    ).toEqual(EXPECTED_COUNTRIES);
    expect(
      new Set(
        UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS.map((sponsor) => sponsor.id)
      ).size
    ).toBe(10);
  });

  it("keeps a broad prestige ladder", () => {
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS]
        .map((sponsor) => sponsor.prestige)
        .sort((left, right) => left - right)
    ).toEqual(EXPECTED_PRESTIGE);
  });

  it("ships a logo and three genuinely distinct jersey choices per sponsor", () => {
    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys).toHaveLength(3);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual([
        "classic",
        "modern",
        "bold",
      ]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
    }
  });

  it("brings the complete catalog to 410 sponsors", () => {
    expect(SPONSORS).toHaveLength(410);
  });
});
