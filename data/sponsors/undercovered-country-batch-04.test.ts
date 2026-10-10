import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS } from "./undercovered-country-batch-04";

describe("UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS", () => {
  it("ajoute cinq marques dans cinq pays jusque-là à un seul sponsor", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS).toHaveLength(5);
    expect(UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS.map((sponsor) => sponsor.countryCode)).toEqual(["TH", "RS", "CR", "ID", "SA"]);
  });

  it("répartit le lot sur les cinq niveaux de prestige", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS.map((sponsor) => sponsor.prestige)).toEqual([1, 2, 3, 4, 5]);
  });

  it("fournit trois propositions et quatre assets uniques par marque", () => {
    const assetPaths = UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3 && sponsor.jerseys.map((jersey) => jersey.style).join(",") === "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le nouveau lot au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
