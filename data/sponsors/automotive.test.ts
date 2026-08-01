import { describe, expect, it } from "vitest";

import { AUTOMOTIVE_SPONSORS } from "./automotive";
import { SPONSORS } from "./index";

describe("AUTOMOTIVE_SPONSORS", () => {
  it("expose dix constructeurs de dix pays avec trois maillots chacun", () => {
    expect(AUTOMOTIVE_SPONSORS).toHaveLength(10);
    expect(
      new Set(AUTOMOTIVE_SPONSORS.map((sponsor) => sponsor.countryCode)).size,
    ).toBe(10);
    expect(
      AUTOMOTIVE_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3),
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = AUTOMOTIVE_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = AUTOMOTIVE_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id),
    );
    const assetPaths = AUTOMOTIVE_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("couvre une progression accessible à premium", () => {
    expect(
      Math.min(
        ...AUTOMOTIVE_SPONSORS.map((sponsor) => sponsor.minimumReputation),
      ),
    ).toBe(0);
    expect(
      Math.max(
        ...AUTOMOTIVE_SPONSORS.map((sponsor) => sponsor.minimumReputation),
      ),
    ).toBe(65);
    expect(AUTOMOTIVE_SPONSORS.some((sponsor) => sponsor.prestige === 2)).toBe(
      true,
    );
    expect(AUTOMOTIVE_SPONSORS.some((sponsor) => sponsor.prestige === 5)).toBe(
      true,
    );
  });

  it("est intégré au catalogue global", () => {
    const catalogIds = new Set(SPONSORS.map((sponsor) => sponsor.id));

    for (const sponsor of AUTOMOTIVE_SPONSORS) {
      expect(catalogIds.has(sponsor.id)).toBe(true);
    }
  });
});
