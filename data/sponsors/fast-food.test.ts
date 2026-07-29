import { describe, expect, it } from "vitest";

import { FAST_FOOD_SPONSORS } from "./fast-food";

describe("catalogue des sponsors de restauration rapide", () => {
  it("expose dix enseignes de dix pays avec trois maillots chacune", () => {
    expect(FAST_FOOD_SPONSORS).toHaveLength(10);
    expect(
      new Set(FAST_FOOD_SPONSORS.map((sponsor) => sponsor.countryCode)).size
    ).toBe(10);
    expect(
      FAST_FOOD_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = FAST_FOOD_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = FAST_FOOD_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id)
    );
    const assetPaths = FAST_FOOD_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("couvre les équipes modestes comme les sponsors premium", () => {
    expect(
      Math.min(
        ...FAST_FOOD_SPONSORS.map((sponsor) => sponsor.minimumReputation)
      )
    ).toBe(0);
    expect(
      Math.max(
        ...FAST_FOOD_SPONSORS.map((sponsor) => sponsor.minimumReputation)
      )
    ).toBe(60);
    expect(
      FAST_FOOD_SPONSORS.some((sponsor) => sponsor.prestige === 2)
    ).toBe(true);
    expect(
      FAST_FOOD_SPONSORS.some((sponsor) => sponsor.prestige === 5)
    ).toBe(true);
  });
});
