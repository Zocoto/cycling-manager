import { describe, expect, it } from "vitest";

import { COUNTRY_EXPANSION_BATCH_13_SPONSORS } from "./country-expansion-batch-13";

describe("country expansion batch 13", () => {
  it("adds five sponsors in countries that previously had one sponsor", () => {
    expect(COUNTRY_EXPANSION_BATCH_13_SPONSORS).toHaveLength(5);
    expect(COUNTRY_EXPANSION_BATCH_13_SPONSORS.map((sponsor) => sponsor.countryCode)).toEqual([
      "FJ",
      "JM",
      "MK",
      "BN",
      "QA",
    ]);
  });

  it("covers five distinct new industries", () => {
    expect(new Set(COUNTRY_EXPANSION_BATCH_13_SPONSORS.map((sponsor) => sponsor.sector)).size).toBe(5);
  });

  it("provides three jersey variants and complete WebP asset paths", () => {
    for (const sponsor of COUNTRY_EXPANSION_BATCH_13_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/[a-z0-9-]+\/logo\.webp$/);
      for (const jersey of sponsor.jerseys) {
        expect(jersey.imagePath).toMatch(/^\/images\/sponsors\/[a-z0-9-]+\/jersey-(classic|modern|bold)\.webp$/);
      }
    }
  });

  it("keeps sponsor economics coherent with prestige", () => {
    const expectedMinimumReputation = new Map([
      [1, 0],
      [2, 30],
      [3, 100],
      [4, 500],
      [5, 1_000],
    ]);

    for (const sponsor of COUNTRY_EXPANSION_BATCH_13_SPONSORS) {
      expect(sponsor.minimumReputation).toBe(expectedMinimumReputation.get(sponsor.prestige));
      expect(sponsor.budgetRange.max).toBeGreaterThan(sponsor.budgetRange.min);
      expect(sponsor.contractDurationRange.max).toBeGreaterThanOrEqual(sponsor.contractDurationRange.min);
    }
  });
});
