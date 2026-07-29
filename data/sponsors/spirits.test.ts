import { describe, expect, it } from "vitest";

import { SPIRITS_SPONSORS } from "./spirits";

describe("catalogue des sponsors de spiritueux", () => {
  it("expose dix maisons de dix pays avec trois maillots chacune", () => {
    expect(SPIRITS_SPONSORS).toHaveLength(10);
    expect(
      new Set(SPIRITS_SPONSORS.map((sponsor) => sponsor.countryCode)).size
    ).toBe(10);
    expect(
      SPIRITS_SPONSORS.every((sponsor) => sponsor.jerseys.length === 3)
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = SPIRITS_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = SPIRITS_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id)
    );
    const assetPaths = SPIRITS_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("couvre les distilleries régionales comme les maisons premium", () => {
    expect(
      Math.min(...SPIRITS_SPONSORS.map((sponsor) => sponsor.minimumReputation))
    ).toBe(0);
    expect(
      Math.max(...SPIRITS_SPONSORS.map((sponsor) => sponsor.minimumReputation))
    ).toBe(65);
    expect(SPIRITS_SPONSORS.some((sponsor) => sponsor.prestige === 2)).toBe(
      true
    );
    expect(SPIRITS_SPONSORS.some((sponsor) => sponsor.prestige === 5)).toBe(
      true
    );
  });
});
