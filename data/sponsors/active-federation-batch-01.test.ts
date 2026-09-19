import { describe, expect, it } from "vitest";

import { ACTIVE_FEDERATION_BATCH_01_SPONSORS } from "./active-federation-batch-01";
import { SPONSORS } from "./index";

const EXPECTED_COUNTRIES = ["LS", "MY", "PG", "DE", "LU", "HR", "SZ", "KG", "SN", "TG"];

describe("ACTIVE_FEDERATION_BATCH_01_SPONSORS", () => {
  it("ajoute un sponsor à dix fédérations actives encore peu couvertes", () => {
    expect(ACTIVE_FEDERATION_BATCH_01_SPONSORS).toHaveLength(10);
    expect(
      [...ACTIVE_FEDERATION_BATCH_01_SPONSORS.map((sponsor) => sponsor.countryCode)].sort(),
    ).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("porte chaque catalogue national à deux ou trois sponsors", () => {
    const expectedTotals = new Map([
      ["LS", 2], ["MY", 2], ["PG", 2], ["DE", 3], ["LU", 3],
      ["HR", 3], ["SZ", 3], ["KG", 3], ["SN", 3], ["TG", 3],
    ]);

    for (const [countryCode, total] of expectedTotals) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(total);
    }
  });

  it("propose dix secteurs distincts et plusieurs niveaux de prestige", () => {
    expect(
      new Set(ACTIVE_FEDERATION_BATCH_01_SPONSORS.map((sponsor) => sponsor.sector)).size,
    ).toBe(10);
    expect(
      new Set(ACTIVE_FEDERATION_BATCH_01_SPONSORS.map((sponsor) => sponsor.prestige)).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("fournit trois maillots et quatre assets uniques par sponsor", () => {
    const assetPaths = ACTIVE_FEDERATION_BATCH_01_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(
      ACTIVE_FEDERATION_BATCH_01_SPONSORS.every(
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

    for (const sponsor of ACTIVE_FEDERATION_BATCH_01_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
