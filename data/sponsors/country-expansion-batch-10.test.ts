import { describe, expect, it } from "vitest";

import { COUNTRY_EXPANSION_BATCH_10_SPONSORS } from "./country-expansion-batch-10";

describe("country expansion batch 10", () => {
  it("adds five original sponsors in countries that previously had one sponsor", () => {
    expect(COUNTRY_EXPANSION_BATCH_10_SPONSORS).toHaveLength(5);
    expect(COUNTRY_EXPANSION_BATCH_10_SPONSORS.map((sponsor) => sponsor.countryCode)).toEqual([
      "BT",
      "BO",
      "KG",
      "MT",
      "SR",
    ]);
  });

  it("provides three distinct jersey variants and complete WebP assets", () => {
    for (const sponsor of COUNTRY_EXPANSION_BATCH_10_SPONSORS) {
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

    for (const sponsor of COUNTRY_EXPANSION_BATCH_10_SPONSORS) {
      expect(sponsor.minimumReputation).toBe(expectedMinimumReputation.get(sponsor.prestige));
      expect(sponsor.budgetRange.max).toBeGreaterThan(sponsor.budgetRange.min);
      expect(sponsor.contractDurationRange.max).toBeGreaterThanOrEqual(sponsor.contractDurationRange.min);
    }
  });
});
