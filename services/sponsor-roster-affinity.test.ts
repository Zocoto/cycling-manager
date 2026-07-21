import { describe, expect, it } from "vitest";

import { buildRiderCountrySponsorAffinities } from "@/lib/game/sponsor-nationality-affinity";

import { generateSponsorProposals } from "./sponsor-proposals";

describe("sponsor proposals with roster nationality affinity", () => {
  it("fait remonter un sponsor étranger porté par un leader de sa nationalité", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 100,
      riderCountryAffinities: buildRiderCountrySponsorAffinities([
        { countryCode: "ES", overall: 85 },
      ]),
      random: () => 0.5,
    });

    expect(proposals[0]?.sponsor.countryCode).toBe("ES");
  });

  it("ne survalorise pas un unique coureur étranger moyen", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 100,
      riderCountryAffinities: buildRiderCountrySponsorAffinities([
        { countryCode: "ES", overall: 55 },
      ]),
      random: () => 0.5,
    });

    expect(
      proposals.every((proposal) => proposal.sponsor.countryCode === "BE")
    ).toBe(true);
  });
});
