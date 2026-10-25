import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { COMMON_INDUSTRIES_BATCH_18_SPONSORS } from "./common-industries-batch-18";

const EXPECTED_COUNTRIES = [
  "ZA", "SA", "BB", "BT", "BA", "BW", "BN", "CM", "CV", "CY",
  "CO", "CR", "CI", "CU", "EG", "EE", "GE", "IN", "KE", "MX",
] as const;

describe("common industries sponsor batch 18", () => {
  it("adds twenty distinct sponsors in twenty undercovered countries", () => {
    expect(COMMON_INDUSTRIES_BATCH_18_SPONSORS).toHaveLength(20);
    expect(new Set(COMMON_INDUSTRIES_BATCH_18_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(20);
    expect(COMMON_INDUSTRIES_BATCH_18_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("provides three differentiated jersey choices and complete assets", () => {
    for (const sponsor of COMMON_INDUSTRIES_BATCH_18_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a useful prestige spread across everyday industries", () => {
    const distribution = COMMON_INDUSTRIES_BATCH_18_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 3, 2: 4, 3: 5, 4: 5, 5: 3 });
  });

  it("brings every selected country to three sponsors and the catalog to 520", () => {
    expect(SPONSORS).toHaveLength(520);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
