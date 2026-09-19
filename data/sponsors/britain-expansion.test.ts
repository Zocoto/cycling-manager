import { describe, expect, it } from "vitest";

import { BRITISH_EXPANSION_SPONSORS } from "./britain-expansion";
import { SPONSORS } from "./index";

describe("BRITISH_EXPANSION_SPONSORS", () => {
  it("ajoute cinq sponsors britanniques au catalogue", () => {
    expect(BRITISH_EXPANSION_SPONSORS).toHaveLength(5);
    expect(BRITISH_EXPANSION_SPONSORS.every((sponsor) => sponsor.countryCode === "GB")).toBe(true);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "GB")).toHaveLength(7);
  });

  it("couvre cinq activités britanniques distinctes et plusieurs niveaux de prestige", () => {
    expect(new Set(BRITISH_EXPANSION_SPONSORS.map((sponsor) => sponsor.sector)).size).toBe(5);
    expect(new Set(BRITISH_EXPANSION_SPONSORS.map((sponsor) => sponsor.prestige)).size).toBeGreaterThanOrEqual(3);
  });

  it("fournit trois maillots et quatre assets uniques par sponsor", () => {
    const assetPaths = BRITISH_EXPANSION_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      BRITISH_EXPANSION_SPONSORS.every(
        (sponsor) =>
          sponsor.jerseys.length === 3 &&
          sponsor.jerseys.map((jersey) => jersey.style).join(",") === "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le lot au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of BRITISH_EXPANSION_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
