import { describe, expect, it } from "vitest";

import { ITALIAN_BRANDS_EXPANSION_SPONSORS } from "./italian-brands-expansion";
import { SPONSORS } from "./index";

describe("ITALIAN_BRANDS_EXPANSION_SPONSORS", () => {
  it("ajoute cinq marques italiennes au catalogue", () => {
    expect(ITALIAN_BRANDS_EXPANSION_SPONSORS).toHaveLength(5);
    expect(ITALIAN_BRANDS_EXPANSION_SPONSORS.every((sponsor) => sponsor.countryCode === "IT")).toBe(true);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "IT")).toHaveLength(26);
  });

  it("emploie des noms de marque courts et des secteurs distincts", () => {
    expect(new Set(ITALIAN_BRANDS_EXPANSION_SPONSORS.map((sponsor) => sponsor.sector)).size).toBe(5);
    expect(ITALIAN_BRANDS_EXPANSION_SPONSORS.every((sponsor) => sponsor.name.split(" ").length <= 2)).toBe(true);
    expect(new Set(ITALIAN_BRANDS_EXPANSION_SPONSORS.map((sponsor) => sponsor.prestige)).size).toBeGreaterThanOrEqual(3);
  });

  it("fournit trois maillots et quatre assets uniques par marque", () => {
    const assetPaths = ITALIAN_BRANDS_EXPANSION_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      ITALIAN_BRANDS_EXPANSION_SPONSORS.every(
        (sponsor) =>
          sponsor.jerseys.length === 3 &&
          sponsor.jerseys.map((jersey) => jersey.style).join(",") === "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le lot au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of ITALIAN_BRANDS_EXPANSION_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
