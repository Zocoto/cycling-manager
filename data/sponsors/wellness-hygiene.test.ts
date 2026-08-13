import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { WELLNESS_HYGIENE_SPONSORS } from "./wellness-hygiene";

const EXPECTED_COUNTRIES = ["BF", "FI", "FR", "GE", "IN", "IS", "JP", "KR", "MA", "WS"];

describe("WELLNESS_HYGIENE_SPONSORS", () => {
  it("expose dix marques internationales avec trois maillots chacune", () => {
    expect(WELLNESS_HYGIENE_SPONSORS).toHaveLength(10);
    expect(
      WELLNESS_HYGIENE_SPONSORS.map((sponsor) => sponsor.countryCode).sort()
    ).toEqual(EXPECTED_COUNTRIES);
    expect(
      WELLNESS_HYGIENE_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
  });

  it("couvre tous les niveaux de prestige et garde une offre économique progressive", () => {
    expect(
      [...new Set(WELLNESS_HYGIENE_SPONSORS.map((sponsor) => sponsor.prestige))].sort()
    ).toEqual([1, 2, 3, 4, 5]);

    for (const sponsor of WELLNESS_HYGIENE_SPONSORS) {
      expect(sponsor.budgetRange.max).toBeGreaterThan(sponsor.budgetRange.min);
      expect(sponsor.contractDurationRange.max).toBeLessThanOrEqual(3);
    }
  });

  it("réserve une version artistique aux bulles de la Savonnerie Calanque", () => {
    const calanque = WELLNESS_HYGIENE_SPONSORS.find(
      (sponsor) => sponsor.id === "savonnerie-calanque"
    );

    expect(calanque?.jerseys.find((jersey) => jersey.style === "bold")?.name).toBe("Bulle 98");
  });

  it("garde des identifiants et des chemins d’assets uniques", () => {
    const sponsorIds = WELLNESS_HYGIENE_SPONSORS.map((sponsor) => sponsor.id);
    const assetPaths = WELLNESS_HYGIENE_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("est raccordé au catalogue global utilisé par le jeu", () => {
    const sponsorIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of WELLNESS_HYGIENE_SPONSORS) {
      expect(sponsorIds.has(sponsor.id)).toBe(true);
    }
  });
});
