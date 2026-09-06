import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS } from "./sporting-nation-prestige-batch-01";

const REQUIRED_PRESTIGE_BY_COUNTRY = {
  AF: 3,
  AM: 5,
  BW: 4,
  CL: 3,
  EC: 5,
  FR: 5,
  HR: 5,
  MD: 4,
  ME: 4,
  PK: 5,
  UY: 3,
} as const;

describe("SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS", () => {
  it("comble les onze écarts de prestige issus de l’audit sportif", () => {
    expect(SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS).toHaveLength(11);

    for (const [countryCode, requiredPrestige] of Object.entries(
      REQUIRED_PRESTIGE_BY_COUNTRY
    )) {
      const maximumPrestige = Math.max(
        ...SPONSORS.filter(
          (sponsor) => sponsor.countryCode === countryCode
        ).map((sponsor) => sponsor.prestige)
      );

      expect(maximumPrestige).toBeGreaterThanOrEqual(requiredPrestige);
    }
  });

  it("propose trois identités de maillot et quatre assets uniques par sponsor", () => {
    const assetPaths = SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS.flatMap(
      (sponsor) => [
        sponsor.logoPath,
        ...sponsor.jerseys.map((jersey) => jersey.imagePath),
      ]
    );

    expect(
      SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS.every(
        (sponsor) =>
          sponsor.jerseys.length === 3 &&
          sponsor.jerseys.map((jersey) => jersey.style).join(",") ===
            "classic,modern,bold"
      )
    ).toBe(true);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("raccorde les onze sponsors au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
