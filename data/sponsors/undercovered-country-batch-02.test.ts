import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS } from "./undercovered-country-batch-02";

describe("UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS", () => {
  it("répartit cinq sponsors sur cinq pays encore peu couverts", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS).toHaveLength(5);
    expect(UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS.map((sponsor) => sponsor.countryCode)).toEqual(["AO", "CZ", "IE", "ES", "CA"]);
  });

  it("couvre tous les niveaux de prestige", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS.map((sponsor) => sponsor.prestige)).toEqual([1, 2, 3, 4, 5]);
  });

  it("fournit trois maillots distincts et quatre assets uniques par marque", () => {
    const assetPaths = UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3 && sponsor.jerseys.map((jersey) => jersey.style).join(",") === "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le lot au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
