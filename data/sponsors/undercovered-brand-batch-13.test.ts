import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_BRAND_BATCH_13_SPONSORS } from "./undercovered-brand-batch-13";

describe("undercovered brand sponsor batch 13", () => {
  const expectedCountryCodes = ["GQ", "LY", "NE", "PS", "SD", "SO", "SS", "TD", "TL", "TM"];

  it("adds ten brands from countries that previously had one sponsor", () => {
    expect(UNDERCOVERED_BRAND_BATCH_13_SPONSORS).toHaveLength(10);
    expect(UNDERCOVERED_BRAND_BATCH_13_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(
      [...expectedCountryCodes].sort(),
    );
    expect(new Set(UNDERCOVERED_BRAND_BATCH_13_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("keeps every activity and visual identity distinct", () => {
    expect(new Set(UNDERCOVERED_BRAND_BATCH_13_SPONSORS.map((sponsor) => sponsor.sector)).size).toBe(10);
    expect(new Set(UNDERCOVERED_BRAND_BATCH_13_SPONSORS.map((sponsor) => sponsor.colors.primary)).size).toBe(10);
  });

  it("covers the complete prestige ladder and three branded jersey options", () => {
    const prestiges = new Set(UNDERCOVERED_BRAND_BATCH_13_SPONSORS.map((sponsor) => sponsor.prestige));
    expect(prestiges).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const sponsor of UNDERCOVERED_BRAND_BATCH_13_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 460 sponsors and each selected nation to two", () => {
    expect(SPONSORS).toHaveLength(460);
    for (const countryCode of expectedCountryCodes) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(2);
    }
  });
});
