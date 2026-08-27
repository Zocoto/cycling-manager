import { describe, expect, it } from "vitest";

import { COUNTRY_EXPANSION_BATCH_02_SPONSORS } from "./country-expansion-batch-02";
import { SPONSORS } from "./index";

describe("COUNTRY_EXPANSION_BATCH_02_SPONSORS", () => {
  it("couvre dix nouveaux pays avec trois maillots par sponsor", () => {
    expect(COUNTRY_EXPANSION_BATCH_02_SPONSORS).toHaveLength(10);
    expect(
      new Set(
        COUNTRY_EXPANSION_BATCH_02_SPONSORS.map(
          (sponsor) => sponsor.countryCode,
        ),
      ).size,
    ).toBe(10);
    expect(
      COUNTRY_EXPANSION_BATCH_02_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3,
      ),
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = COUNTRY_EXPANSION_BATCH_02_SPONSORS.map(
      (sponsor) => sponsor.id,
    );
    const jerseyIds = COUNTRY_EXPANSION_BATCH_02_SPONSORS.flatMap(
      (sponsor) => sponsor.jerseys.map((jersey) => jersey.id),
    );
    const assetPaths = COUNTRY_EXPANSION_BATCH_02_SPONSORS.flatMap(
      (sponsor) => [
        sponsor.logoPath,
        ...sponsor.jerseys.map((jersey) => jersey.imagePath),
      ],
    );

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("respecte les seuils de réputation et la gamme économique validée", () => {
    const prestiges = new Set(
      COUNTRY_EXPANSION_BATCH_02_SPONSORS.map(
        (sponsor) => sponsor.prestige,
      ),
    );
    const expectedMinimumReputation = new Map([
      [1, 0],
      [2, 30],
      [3, 100],
      [4, 500],
      [5, 1_000],
    ]);

    expect(prestiges).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(
      COUNTRY_EXPANSION_BATCH_02_SPONSORS.every(
        (sponsor) =>
          sponsor.minimumReputation ===
          expectedMinimumReputation.get(sponsor.prestige),
      ),
    ).toBe(true);
    expect(
      Math.min(
        ...COUNTRY_EXPANSION_BATCH_02_SPONSORS.map(
          (sponsor) => sponsor.budgetRange.min,
        ),
      ),
    ).toBe(95_000);
    expect(
      Math.max(
        ...COUNTRY_EXPANSION_BATCH_02_SPONSORS.map(
          (sponsor) => sponsor.budgetRange.max,
        ),
      ),
    ).toBe(2_150_000);
  });

  it("est intégré au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of COUNTRY_EXPANSION_BATCH_02_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
