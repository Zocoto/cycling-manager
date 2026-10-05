import { describe, expect, it } from "vitest";

import { generateSponsorProposals } from "./sponsor-proposals";
import { SPONSORS } from "@/data/sponsors";

describe("sponsor proposals with featured rider nationality", () => {
  it("keeps a Rwandan offer for an eligible Jphilou-like team across different draws", () => {
    for (const draw of [0, 0.15, 0.5, 0.85, 0.999]) {
      const proposals = generateSponsorProposals({
        directorCountryCode: "RW", teamCountryCode: "RW", rosterMajorityCountryCode: "RW",
        directorReputation: 30, random: () => draw,
      });
      expect(proposals).toHaveLength(3);
      expect(proposals.some(proposal => proposal.sponsor.countryCode === "RW")).toBe(true);
    }
  });
  it("keeps the Rwandan national-affinity bridge when the usual eligible sponsor is reserved", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "RW", teamCountryCode: "RW", rosterMajorityCountryCode: "RW", directorReputation: 30,
      unavailableSponsorIds: SPONSORS.filter(sponsor => sponsor.countryCode === "RW" && sponsor.minimumReputation <= 30).map(sponsor => sponsor.id),
      random: () => 0.5,
    });
    expect(proposals).toHaveLength(3);
    expect(proposals.some(proposal => proposal.sponsor.countryCode === "RW")).toBe(true);
  });
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
