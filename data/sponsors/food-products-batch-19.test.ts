import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { FOOD_PRODUCTS_BATCH_19_SPONSORS } from "./food-products-batch-19";

const EXPECTED_COUNTRIES = [
  "BH", "BY", "BZ", "CF", "CZ", "DJ", "DO", "ER", "GA", "HN",
  "HT", "IQ", "IS", "KW", "LS", "MT", "MK", "ML", "MZ", "SE",
] as const;

describe("food products sponsor batch 19", () => {
  it("adds twenty distinct food brands in twenty undercovered countries", () => {
    expect(FOOD_PRODUCTS_BATCH_19_SPONSORS).toHaveLength(20);
    expect(new Set(FOOD_PRODUCTS_BATCH_19_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(20);
    expect(FOOD_PRODUCTS_BATCH_19_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("covers the requested food categories", () => {
    const sectors = FOOD_PRODUCTS_BATCH_19_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    for (const keyword of ["soda", "jus", "conserve", "surgelé", "compote", "yaourt", "chocolat", "céréale"]) {
      expect(sectors).toContain(keyword);
    }
  });

  it("provides three differentiated jersey choices and complete asset paths", () => {
    for (const sponsor of FOOD_PRODUCTS_BATCH_19_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a balanced prestige spread", () => {
    const distribution = FOOD_PRODUCTS_BATCH_19_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 3, 2: 5, 3: 6, 4: 3, 5: 3 });
  });

  it("brings every selected country to three sponsors and the catalog to 540", () => {
    expect(SPONSORS).toHaveLength(540);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
