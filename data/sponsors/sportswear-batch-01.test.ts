import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { SPORTSWEAR_BATCH_01_SPONSORS } from "./sportswear-batch-01";

const TARGET_COUNTRIES = ["AU", "BG", "DE", "ES", "LU", "MU", "NA", "NO", "SE", "SZ"];

describe("SPORTSWEAR_BATCH_01_SPONSORS", () => {
  it("ajoute dix équipementiers dans dix pays jusque-là peu représentés", () => {
    expect(SPORTSWEAR_BATCH_01_SPONSORS).toHaveLength(10);
    expect(
      SPORTSWEAR_BATCH_01_SPONSORS.map((sponsor) => sponsor.countryCode).sort(),
    ).toEqual(TARGET_COUNTRIES);

    for (const countryCode of TARGET_COUNTRIES) {
      expect(
        SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode).length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("propose trois maillots et quatre assets uniques par équipementier", () => {
    const assetPaths = SPORTSWEAR_BATCH_01_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      SPORTSWEAR_BATCH_01_SPONSORS.every(
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

    for (const sponsor of SPORTSWEAR_BATCH_01_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
