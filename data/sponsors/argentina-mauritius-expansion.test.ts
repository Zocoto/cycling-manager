import { describe, expect, it } from "vitest";

import { ARGENTINA_MAURITIUS_EXPANSION_SPONSORS } from "./argentina-mauritius-expansion";
import { SPONSORS } from "./index";

describe("ARGENTINA_MAURITIUS_EXPANSION_SPONSORS", () => {
  it("ajoute trois sponsors à l’Argentine et trois à Maurice", () => {
    expect(ARGENTINA_MAURITIUS_EXPANSION_SPONSORS).toHaveLength(6);
    expect(
      ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.filter(
        (sponsor) => sponsor.countryCode === "AR",
      ),
    ).toHaveLength(3);
    expect(
      ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.filter(
        (sponsor) => sponsor.countryCode === "MU",
      ),
    ).toHaveLength(3);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "AR")).toHaveLength(5);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "MU")).toHaveLength(5);
  });

  it("couvre six secteurs locaux distincts et plusieurs niveaux de prestige", () => {
    expect(
      new Set(ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.map((sponsor) => sponsor.sector)).size,
    ).toBe(6);
    expect(
      new Set(ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.map((sponsor) => sponsor.prestige)).size,
    ).toBeGreaterThanOrEqual(4);
  });

  it("fournit trois maillots et quatre assets uniques par sponsor", () => {
    const assetPaths = ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.flatMap(
      (sponsor) => [
        sponsor.logoPath,
        ...sponsor.jerseys.map((jersey) => jersey.imagePath),
      ],
    );

    expect(
      ARGENTINA_MAURITIUS_EXPANSION_SPONSORS.every(
        (sponsor) =>
          sponsor.jerseys.length === 3 &&
          sponsor.jerseys.map((jersey) => jersey.style).join(",") ===
            "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le lot au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of ARGENTINA_MAURITIUS_EXPANSION_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
