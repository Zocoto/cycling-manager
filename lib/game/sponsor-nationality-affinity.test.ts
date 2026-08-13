import { describe, expect, it } from "vitest";

import {
  normalizeFeaturedRiderSponsorAffinity,
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
});