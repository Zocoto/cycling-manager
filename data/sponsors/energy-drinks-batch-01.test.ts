import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { ENERGY_DRINK_BATCH_01_SPONSORS } from "./energy-drinks-batch-01";

const TARGET_COUNTRIES = ["AR", "CO", "EG", "ET", "MV", "TG", "TZ", "UZ", "VN", "YE"];

describe("ENERGY_DRINK_BATCH_01_SPONSORS", () => {
  it("ajoute dix marques dans dix pays jusque-là peu représentés", () => {
    expect(ENERGY_DRINK_BATCH_01_SPONSORS).toHaveLength(10);
    expect(
      ENERGY_DRINK_BATCH_01_SPONSORS.map((sponsor) => sponsor.countryCode).sort()
    ).toEqual(TARGET_COUNTRIES);

    for (const countryCode of TARGET_COUNTRIES) {
      expect(
        SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode).length
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("propose trois identités de maillot et quatre assets uniques par sponsor", () => {
    const assetPaths = ENERGY_DRINK_BATCH_01_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      ENERGY_DRINK_BATCH_01_SPONSORS.every(
        (sponsor) =>
          sponsor.jerseys.length === 3 &&
          sponsor.jerseys.map((jersey) => jersey.style).join(",") ===
            "classic,modern,bold"
      )
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde les dix sponsors au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of ENERGY_DRINK_BATCH_01_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
