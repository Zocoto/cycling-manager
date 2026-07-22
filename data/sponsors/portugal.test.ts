import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { PORTUGUESE_SPONSORS } from "./portugal";

describe("PORTUGUESE_SPONSORS", () => {
  it("expose cinq sponsors portugais avec trois maillots chacun", () => {
    expect(PORTUGUESE_SPONSORS).toHaveLength(5);
    expect(PORTUGUESE_SPONSORS.every((sponsor) => sponsor.countryCode === "PT")).toBe(true);
    expect(PORTUGUESE_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)).toBe(true);
  });

  it("garde des identifiants et des chemins d’assets uniques", () => {
    const sponsorIds = PORTUGUESE_SPONSORS.map((sponsor) => sponsor.id);
    const assetPaths = PORTUGUESE_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("est raccordé au catalogue global utilisé par le jeu", () => {
    const sponsorIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of PORTUGUESE_SPONSORS) {
      expect(sponsorIds.has(sponsor.id)).toBe(true);
    }
  });
});
