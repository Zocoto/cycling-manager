import { describe, expect, it } from "vitest";

import {
  getCombinedInternationalSchoolSponsorContactChance,
  getInternationalSchoolSponsorContactChance,
  normalizeFeaturedRiderSponsorAffinity,
  normalizeInternationalSchoolSponsorAffinities,
  normalizeSponsorCountryCode,
} from "./sponsor-nationality-affinity";

describe("sponsor nationality affinity", () => {
  it("normalise les codes pays du DS et du leader UCI", () => {
    expect(normalizeSponsorCountryCode(" fr ")).toBe("FR");
    expect(
      normalizeFeaturedRiderSponsorAffinity({
        countryCode: " es ",
        uciPoints: 125,
      })
    ).toEqual({ countryCode: "ES", uciPoints: 125 });
  });

  it("ignore un coureur qui n'est pas classé UCI", () => {
    expect(
      normalizeFeaturedRiderSponsorAffinity({
        countryCode: "ES",
        uciPoints: 0,
      })
    ).toBeNull();
  });

  it("fait progresser la chance de contact sponsor de 30 à 70 %", () => {
    expect(
      [1, 2, 3, 4, 5].map(getInternationalSchoolSponsorContactChance),
    ).toEqual([0.3, 0.4, 0.5, 0.6, 0.7]);
    expect(getInternationalSchoolSponsorContactChance(0)).toBe(0);
  });

  it("normalise les écoles et conserve le meilleur niveau par pays", () => {
    expect(
      normalizeInternationalSchoolSponsorAffinities([
        { countryCode: " jp ", qualityLevel: 2 },
        { countryCode: "JP", qualityLevel: 4 },
        { countryCode: "ca", qualityLevel: 9 },
      ]),
    ).toEqual([
      { countryCode: "CA", qualityLevel: 5 },
      { countryCode: "JP", qualityLevel: 4 },
    ]);
  });

  it("cumule les écoles sans dépasser 85 % de chance de contact", () => {
    expect(
      getCombinedInternationalSchoolSponsorContactChance([
        { countryCode: "JP", qualityLevel: 1 },
        { countryCode: "CA", qualityLevel: 1 },
      ]),
    ).toBeCloseTo(0.51);
    expect(
      getCombinedInternationalSchoolSponsorContactChance([
        { countryCode: "JP", qualityLevel: 5 },
        { countryCode: "CA", qualityLevel: 5 },
        { countryCode: "BR", qualityLevel: 5 },
      ]),
    ).toBe(0.85);
  });
});
