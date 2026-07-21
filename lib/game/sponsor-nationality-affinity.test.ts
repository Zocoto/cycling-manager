import { describe, expect, it } from "vitest";

import {
  buildRiderCountrySponsorAffinities,
  calculateOverallRating,
  getSponsorCountryProposalWeight,
} from "./sponsor-nationality-affinity";

describe("sponsor nationality affinity", () => {
  it("cumule le nombre de coureurs tout en donnant davantage de poids aux leaders", () => {
    const affinities = buildRiderCountrySponsorAffinities([
      { countryCode: "DE", overall: 82 },
      { countryCode: "DE", overall: 61 },
      { countryCode: "ES", overall: 61 },
    ]);

    expect(affinities[0]).toMatchObject({
      countryCode: "DE",
      riderCount: 2,
      topOverall: 82,
    });
    expect(affinities[0]!.affinityPoints).toBeGreaterThan(
      affinities[1]!.affinityPoints
    );
  });

  it("rend un sponsor étranger très crédible avec un coureur de premier plan", () => {
    const riderCountryAffinities = buildRiderCountrySponsorAffinities([
      { countryCode: "ES", overall: 85 },
    ]);
    const neighboringCountryCodes = new Set(["DE", "FR", "LU", "NL"]);
    const belgianWeight = getSponsorCountryProposalWeight({
      sponsorCountryCode: "BE",
      teamCountryCode: "BE",
      neighboringCountryCodes,
      riderCountryAffinities,
    });
    const spanishWeight = getSponsorCountryProposalWeight({
      sponsorCountryCode: "ES",
      teamCountryCode: "BE",
      neighboringCountryCodes,
      riderCountryAffinities,
    });

    expect(spanishWeight).toBeGreaterThan(belgianWeight);
  });

  it("calcule la moyenne générale sur toutes les caractéristiques", () => {
    expect(calculateOverallRating([60, 70, 80])).toBe(70);
    expect(calculateOverallRating([])).toBe(0);
  });
});
