import { describe, expect, it } from "vitest";

import { POSTAL_SERVICE_SPONSORS } from "./postal-services";

describe("catalogue des sponsors de services postaux", () => {
  it("expose cinq opérateurs de cinq pays avec trois maillots chacun", () => {
    expect(POSTAL_SERVICE_SPONSORS).toHaveLength(5);
    expect(
      new Set(
        POSTAL_SERVICE_SPONSORS.map((sponsor) => sponsor.countryCode),
      ).size,
    ).toBe(5);
    expect(
      POSTAL_SERVICE_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3,
      ),
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = POSTAL_SERVICE_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = POSTAL_SERVICE_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id),
    );
    const assetPaths = POSTAL_SERVICE_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("couvre les réseaux locaux comme les opérateurs établis", () => {
    expect(
      Math.min(
        ...POSTAL_SERVICE_SPONSORS.map(
          (sponsor) => sponsor.minimumReputation,
        ),
      ),
    ).toBe(0);
    expect(
      Math.max(
        ...POSTAL_SERVICE_SPONSORS.map(
          (sponsor) => sponsor.minimumReputation,
        ),
      ),
    ).toBe(45);
    expect(
      POSTAL_SERVICE_SPONSORS.some((sponsor) => sponsor.prestige === 2),
    ).toBe(true);
    expect(
      POSTAL_SERVICE_SPONSORS.some((sponsor) => sponsor.prestige === 4),
    ).toBe(true);
  });
});
