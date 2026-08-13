import { describe, expect, it } from "vitest";

import { BRETON_SPONSORS } from "./brittany";

describe("catalogue des sponsors bretons", () => {
  it("expose cinq produits regionaux avec trois maillots chacun", () => {
    expect(BRETON_SPONSORS).toHaveLength(5);
    expect(
      BRETON_SPONSORS.every((sponsor) => sponsor.countryCode === "FR")
    ).toBe(true);
    expect(
      BRETON_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
    expect(
      BRETON_SPONSORS.every((sponsor) =>
        ["classic", "modern", "bold"].every((style) =>
          sponsor.jerseys.some((jersey) => jersey.style === style)
        )
      )
    ).toBe(true);
  });

  it("reference des identifiants et assets uniques", () => {
    const sponsorIds = BRETON_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = BRETON_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id)
    );
    const assetPaths = BRETON_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("reste accessible aux equipes regionales sans sponsor elite", () => {
    expect(BRETON_SPONSORS.map((sponsor) => sponsor.prestige).sort()).toEqual([
      1, 2, 2, 3, 3,
    ]);
    expect(BRETON_SPONSORS.every((sponsor) => sponsor.prestige <= 3)).toBe(true);
  });
});
