import { describe, expect, it } from "vitest";

import { BANKING_SPONSORS } from "./banking";

describe("catalogue des sponsors bancaires", () => {
  it("expose huit sponsors de huit pays avec trois maillots chacun", () => {
    expect(BANKING_SPONSORS).toHaveLength(8);
    expect(new Set(BANKING_SPONSORS.map((sponsor) => sponsor.countryCode)).size).toBe(8);
    expect(BANKING_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = BANKING_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = BANKING_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id)
    );
    const assetPaths = BANKING_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("propose une progression du crédit local à la banque premium", () => {
    expect(Math.min(...BANKING_SPONSORS.map((sponsor) => sponsor.minimumReputation))).toBe(0);
    expect(Math.max(...BANKING_SPONSORS.map((sponsor) => sponsor.minimumReputation))).toBe(65);
    expect(BANKING_SPONSORS.some((sponsor) => sponsor.prestige === 2)).toBe(true);
    expect(BANKING_SPONSORS.some((sponsor) => sponsor.prestige === 5)).toBe(true);
  });
});