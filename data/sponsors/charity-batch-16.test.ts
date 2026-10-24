import { describe, expect, it } from "vitest";

import { CHARITY_BATCH_16_SPONSORS } from "./charity-batch-16";
import { SPONSORS } from "./index";

describe("charity sponsor batch 16", () => {
  const expectedCountryCodes = ["BD", "BJ", "BI", "ET", "FJ", "GT", "JO", "LB", "MG", "JM"];

  it("adds ten charitable sponsors to countries tied at the current minimum", () => {
    expect(CHARITY_BATCH_16_SPONSORS).toHaveLength(10);
    expect(CHARITY_BATCH_16_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(
      [...expectedCountryCodes].sort(),
    );
    expect(new Set(CHARITY_BATCH_16_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("covers ten distinct charitable missions", () => {
    expect(new Set(CHARITY_BATCH_16_SPONSORS.map((sponsor) => sponsor.sector)).size).toBe(10);
    expect(new Set(CHARITY_BATCH_16_SPONSORS.map((sponsor) => sponsor.colors.primary)).size).toBe(10);
  });

  it("covers all prestige levels with three branded jerseys each", () => {
    expect(new Set(CHARITY_BATCH_16_SPONSORS.map((sponsor) => sponsor.prestige))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const sponsor of CHARITY_BATCH_16_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 490 sponsors and raises each selected country to three", () => {
    expect(SPONSORS).toHaveLength(490);
    for (const countryCode of expectedCountryCodes) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
