import { describe, expect, it } from "vitest";

import { ENERGY_SPONSORS } from "./energy";

describe("catalogue des sponsors énergétiques", () => {
  it("expose six sponsors de six pays avec trois maillots chacun", () => {
    expect(ENERGY_SPONSORS).toHaveLength(6);
    expect(new Set(ENERGY_SPONSORS.map((sponsor) => sponsor.countryCode)).size).toBe(6);
    expect(
      ENERGY_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = ENERGY_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = ENERGY_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id)
    );
    const assetPaths = ENERGY_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("conserve Petrolove comme sponsor vénézuélien premium", () => {
    const petrolove = ENERGY_SPONSORS.find((sponsor) => sponsor.id === "petrolove");

    expect(petrolove).toMatchObject({
      name: "Petrolove",
      countryCode: "VE",
      prestige: 5,
      minimumReputation: 60,
    });
  });
});