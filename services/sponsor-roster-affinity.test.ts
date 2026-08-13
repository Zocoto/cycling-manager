import { describe, expect, it } from "vitest";

import { generateSponsorProposals } from "./sponsor-proposals";

describe("sponsor proposals with featured rider nationality", () => {
  it("garantit une offre du pays du DS et une du leader UCI étranger", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 250,
      featuredRiderAffinity: { countryCode: "ES", uciPoints: 420 },
      random: () => 0.5,
    });

    expect(proposals).toHaveLength(3);
    expect(proposals[0]?.sponsor.countryCode).toBe("BE");
    expect(proposals[1]?.sponsor.countryCode).toBe("ES");
  });

  it("ignore une affinité sans points UCI", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 250,
      featuredRiderAffinity: { countryCode: "ES", uciPoints: 0 },
      random: () => 0.5,
    });

    expect(
      proposals.every((proposal) => proposal.sponsor.countryCode === "BE")
    ).toBe(true);
  });
});