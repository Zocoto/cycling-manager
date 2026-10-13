import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS } from "./undercovered-country-batch-09";

const EXPECTED_COUNTRIES = ["CM", "GA", "GN", "HT", "LR", "MM", "NI", "SK", "SV", "UG"];
const EXPECTED_PRESTIGE = [1, 1, 2, 2, 2, 3, 3, 3, 4, 5];

describe("undercovered country sponsor batch 09", () => {
  it("adds ten distinct sponsors in ten undercovered countries", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS).toHaveLength(10);
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS]
        .map((sponsor) => sponsor.countryCode)
        .sort()
    ).toEqual(EXPECTED_COUNTRIES);
    expect(new Set(UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("keeps a complete prestige ladder", () => {
    expect(
      [...UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS]
        .map((sponsor) => sponsor.prestige)
        .sort((left, right) => left - right)
    ).toEqual(EXPECTED_PRESTIGE);
  });

  it("uses mainstream cycling sponsorship sectors", () => {
    const sectors = UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase());
    expect(sectors.some((sector) => sector.includes("banque"))).toBe(true);
    expect(sectors.some((sector) => sector.includes("télécommunications"))).toBe(true);
    expect(sectors.some((sector) => sector.includes("automobile"))).toBe(true);
    expect(sectors.some((sector) => sector.includes("distribution"))).toBe(true);
    expect(sectors.some((sector) => sector.includes("énergie"))).toBe(true);
  });

  it("ships a logo and three brand-led jersey choices per sponsor", () => {
    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys).toHaveLength(3);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
    }
  });

  it("brings the complete catalog to 430 sponsors", () => {
    expect(SPONSORS).toHaveLength(430);
  });
});
