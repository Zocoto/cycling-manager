import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { ORIGINAL_SECTOR_BATCH_22_SPONSORS } from "./original-sector-batch-22";

const EXPECTED_COUNTRIES = [
  "SK", "SO", "SR", "SS", "SV", "SY", "TD", "TJ", "TL", "TM",
  "TN", "TR", "TT", "TZ", "UA", "UG", "UZ", "VE", "VU", "WS",
] as const;

describe("original sector sponsor batch 22", () => {
  it("adds twenty original brands to twenty least-covered countries", () => {
    expect(ORIGINAL_SECTOR_BATCH_22_SPONSORS).toHaveLength(20);
    expect(new Set(ORIGINAL_SECTOR_BATCH_22_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(20);
    expect(ORIGINAL_SECTOR_BATCH_22_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("covers a deliberately varied set of plausible activities", () => {
    const sectors = ORIGINAL_SECTOR_BATCH_22_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    for (const keyword of ["acoustique", "anticorrosion", "colorimétrique", "passerelles", "parfumerie", "oxygénation", "cacao", "optique", "robot", "roulements"]) {
      expect(sectors).toContain(keyword);
    }
  });

  it("provides three complete and differentiated jersey choices", () => {
    for (const sponsor of ORIGINAL_SECTOR_BATCH_22_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a balanced prestige spread", () => {
    const distribution = ORIGINAL_SECTOR_BATCH_22_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 3, 2: 5, 3: 6, 4: 3, 5: 3 });
  });

  it("brings every selected country to three sponsors and the catalog to 600", () => {
    expect(SPONSORS).toHaveLength(600);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
