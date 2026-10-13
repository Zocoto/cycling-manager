import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS } from "./undercovered-country-batch-06";

describe("UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS", () => {
  it("ajoute sept marques dans sept pays jusque-là à un seul sponsor", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS).toHaveLength(7);
    expect(UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS.map((sponsor) => sponsor.countryCode)).toEqual(["BF", "GT", "TT", "KZ", "BA", "PA", "VE"]);
  });

  it("amène le catalogue global à quatre cents sponsors", () => {
    expect(SPONSORS).toHaveLength(400);
  });

  it("répartit le lot du prestige local au prestige international", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS.map((sponsor) => sponsor.prestige)).toEqual([1, 2, 2, 3, 3, 4, 5]);
  });

  it("fournit trois propositions et quatre assets uniques par marque", () => {
    const assetPaths = UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3 && sponsor.jerseys.map((jersey) => jersey.style).join(",") === "classic,modern,bold",
      ),
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde le lot complet au catalogue", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
