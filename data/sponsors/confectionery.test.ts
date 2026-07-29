import { describe, expect, it } from "vitest";

import { CONFECTIONERY_SPONSORS } from "./confectionery";
import { SPONSORS } from "./index";

const EXPECTED_COUNTRIES = ["BR", "CN", "DK", "MG", "PK", "US"];

describe("CONFECTIONERY_SPONSORS", () => {
  it("expose six confiseries internationales avec trois maillots chacune", () => {
    expect(CONFECTIONERY_SPONSORS).toHaveLength(6);
    expect(
      CONFECTIONERY_SPONSORS.map((sponsor) => sponsor.countryCode).sort()
    ).toEqual(EXPECTED_COUNTRIES);
    expect(
      CONFECTIONERY_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
  });

  it("garde des identifiants et des chemins d’assets uniques", () => {
    const sponsorIds = CONFECTIONERY_SPONSORS.map((sponsor) => sponsor.id);
    const assetPaths = CONFECTIONERY_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("est raccordé au catalogue global utilisé par le jeu", () => {
    const sponsorIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of CONFECTIONERY_SPONSORS) {
      expect(sponsorIds.has(sponsor.id)).toBe(true);
    }
  });
});
