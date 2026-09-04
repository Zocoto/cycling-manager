import { describe, expect, it } from "vitest";

import { generateSponsorProposals } from "@/services/sponsor-proposals";

import { BAHAMIAN_SPONSORS } from "./bahamas";
import { SPONSORS } from ".";

describe("Bahamian sponsors", () => {
  it("adds three sponsors at distinct prestige levels", () => {
    expect(BAHAMIAN_SPONSORS).toHaveLength(3);
    expect(BAHAMIAN_SPONSORS.map((sponsor) => sponsor.prestige)).toEqual([
      1, 2, 4,
    ]);
  });

  it("completes the Bahamian catalog from prestige one to four", () => {
    const bahamianSponsors = SPONSORS.filter(
      (sponsor) => sponsor.countryCode === "BS"
    );

    expect(bahamianSponsors).toHaveLength(4);
    expect(
      bahamianSponsors.map((sponsor) => sponsor.prestige).sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4]);
  });

  it("can fill a J21 proposal set with Bahamian sponsors", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BS",
      directorReputation: 10_000,
      proposalCount: 3,
      random: () => 0.42,
    });

    expect(proposals).toHaveLength(3);
    expect(
      proposals.every((proposal) => proposal.sponsor.countryCode === "BS")
    ).toBe(true);
  });

  it("provides three unique WebP jersey variants per sponsor", () => {
    for (const sponsor of BAHAMIAN_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual([
        "classic",
        "modern",
        "bold",
      ]);
      expect(
        new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size
      ).toBe(3);
      expect(sponsor.logoPath).toMatch(
        /^\/images\/sponsors\/[a-z0-9-]+\/logo\.webp$/
      );
    }
  });
});
