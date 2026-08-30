import { describe, expect, it } from "vitest";

import { generateSponsorProposals } from "@/services/sponsor-proposals";

import { SPONSORS } from ".";
import { ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS } from "./active-team-country-batch-01";

describe("active team country sponsor batch 01", () => {
  it("adds sixteen sponsors across the four priority countries", () => {
    expect(ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS).toHaveLength(16);
    expect(
      Object.fromEntries(
        ["EC", "RW", "CH", "PL"].map((countryCode) => [
          countryCode,
          ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS.filter(
            (sponsor) => sponsor.countryCode === countryCode
          ).length,
        ])
      )
    ).toEqual({ EC: 4, RW: 4, CH: 4, PL: 4 });
  });

  it("brings every priority country to five national sponsors", () => {
    expect(
      Object.fromEntries(
        ["EC", "RW", "CH", "PL"].map((countryCode) => [
          countryCode,
          SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode).length,
        ])
      )
    ).toEqual({ EC: 5, RW: 5, CH: 5, PL: 5 });
  });

  it("can fill all three J21 proposals with national sponsors", () => {
    for (const countryCode of ["EC", "RW", "CH", "PL"]) {
      const proposals = generateSponsorProposals({
        directorCountryCode: countryCode,
        directorReputation: 10_000,
        proposalCount: 3,
        random: () => 0.42,
      });

      expect(proposals).toHaveLength(3);
      expect(proposals.every((proposal) => proposal.sponsor.countryCode === countryCode)).toBe(true);
    }
  });

  it("provides three unique WebP jersey variants per sponsor", () => {
    for (const sponsor of ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/[a-z0-9-]+\/logo\.webp$/);
      for (const jersey of sponsor.jerseys) {
        expect(jersey.imagePath).toMatch(/^\/images\/sponsors\/[a-z0-9-]+\/jersey-(classic|modern|bold)\.webp$/);
      }
    }
  });
});
