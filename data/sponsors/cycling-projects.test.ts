import { describe, expect, it } from "vitest";

import { CYCLING_PROJECT_SPONSORS } from "./cycling-projects";

describe("catalogue des sponsors issus de projets cyclistes", () => {
  it("expose dix projets de dix pays avec trois maillots chacun", () => {
    expect(CYCLING_PROJECT_SPONSORS).toHaveLength(10);
    expect(
      new Set(
        CYCLING_PROJECT_SPONSORS.map((sponsor) => sponsor.countryCode),
      ).size,
    ).toBe(10);
    expect(
      CYCLING_PROJECT_SPONSORS.every(
        (sponsor) => sponsor.jerseys.length === 3,
      ),
    ).toBe(true);
  });

  it("référence des identifiants et assets uniques", () => {
    const sponsorIds = CYCLING_PROJECT_SPONSORS.map((sponsor) => sponsor.id);
    const jerseyIds = CYCLING_PROJECT_SPONSORS.flatMap((sponsor) =>
      sponsor.jerseys.map((jersey) => jersey.id),
    );
    const assetPaths = CYCLING_PROJECT_SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(new Set(sponsorIds).size).toBe(sponsorIds.length);
    expect(new Set(jerseyIds).size).toBe(jerseyIds.length);
    expect(new Set(assetPaths).size).toBe(assetPaths.length);
  });

  it("propose une progression du projet régional au laboratoire premium", () => {
    expect(
      Math.min(
        ...CYCLING_PROJECT_SPONSORS.map(
          (sponsor) => sponsor.minimumReputation,
        ),
      ),
    ).toBe(0);
    expect(
      Math.max(
        ...CYCLING_PROJECT_SPONSORS.map(
          (sponsor) => sponsor.minimumReputation,
        ),
      ),
    ).toBe(65);
    expect(
      CYCLING_PROJECT_SPONSORS.some((sponsor) => sponsor.prestige === 2),
    ).toBe(true);
    expect(
      CYCLING_PROJECT_SPONSORS.some((sponsor) => sponsor.prestige === 5),
    ).toBe(true);
  });
});
