import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS } from "./undercovered-country-batch-08";

const EXPECTED_COUNTRIES = ["BY", "CF", "CV", "DJ", "GY", "HN", "IQ", "LA", "LK", "MZ"];
const EXPECTED_PRESTIGE = [1, 1, 2, 2, 2, 3, 3, 3, 4, 5];

describe("undercovered country sponsor batch 08", () => {
  it("adds ten distinct sponsors for ten previously undercovered countries", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS).toHaveLength(10);
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS]
        .map((sponsor) => sponsor.countryCode)
        .sort()
    ).toEqual(EXPECTED_COUNTRIES);
    expect(
      new Set(
        UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS.map((sponsor) => sponsor.id)
      ).size
    ).toBe(10);
  });

  it("keeps a broad prestige ladder", () => {
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS]
        .map((sponsor) => sponsor.prestige)
        .sort((left, right) => left - right)
    ).toEqual(EXPECTED_PRESTIGE);
  });

  it("ships a logo and three genuinely distinct jersey choices per sponsor", () => {
    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS) {
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

  it("brings the complete catalog to 420 sponsors", () => {
    expect(SPONSORS).toHaveLength(420);
  });
});
