import { describe, expect, it } from "vitest";

import { AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS } from "./austria-north-korea-expansion";
import { SPONSORS } from "./index";

describe("AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS", () => {
  it("ajoute trois sponsors à l’Autriche et trois à la Corée du Nord", () => {
    expect(AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS).toHaveLength(6);
    expect(
      AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS.filter(
        (sponsor) => sponsor.countryCode === "AT",
      ),
    ).toHaveLength(3);
    expect(
      AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS.filter(
        (sponsor) => sponsor.countryCode === "KP",
      ),
    ).toHaveLength(3);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "AT")).toHaveLength(4);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "KP")).toHaveLength(4);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "WS")).toHaveLength(1);
  });

  it("fournit trois maillots et quatre assets uniques par sponsor", () => {
    const assetPaths = AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS.flatMap(
      (sponsor) => [
        sponsor.logoPath,
        ...sponsor.jerseys.map((jersey) => jersey.imagePath),
      ],
    );

    expect(
      AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS.every(
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

    for (const sponsor of AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
