import { describe, expect, it } from "vitest";

import { AGRI_FOOD_BATCH_23_SPONSORS } from "./agri-food-batch-23";
import { SPONSORS } from "./index";

const EXPECTED_COUNTRIES = ["AL", "AM", "BW", "CV", "GE", "NP", "PY", "SR", "YE", "ZW"] as const;

describe("agri-food sponsor batch 23", () => {
  it("adds ten food brands to ten least-covered countries", () => {
    expect(AGRI_FOOD_BATCH_23_SPONSORS).toHaveLength(10);
    expect(new Set(AGRI_FOOD_BATCH_23_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
    expect(AGRI_FOOD_BATCH_23_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("uses plausible local food activities and brand names", () => {
    const sectors = AGRI_FOOD_BATCH_23_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    for (const keyword of ["miel", "millet", "laitiers", "abricots", "sorgho", "cachupa", "matsoni", "thés", "manioc", "sauces"]) {
      expect(sectors).toContain(keyword);
    }
  });

  it("provides three complete and differentiated jersey choices", () => {
    for (const sponsor of AGRI_FOOD_BATCH_23_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a balanced prestige spread", () => {
    const distribution = AGRI_FOOD_BATCH_23_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 2, 2: 3, 3: 3, 4: 1, 5: 1 });
  });

  it("raises Yemen and Zimbabwe to three sponsors and the catalog to 610", () => {
    expect(SPONSORS).toHaveLength(610);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "YE")).toHaveLength(3);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "ZW")).toHaveLength(3);
    for (const countryCode of EXPECTED_COUNTRIES.filter((code) => code !== "YE" && code !== "ZW")) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(4);
    }
  });
});
