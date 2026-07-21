import { describe, expect, it } from "vitest";

import { generateSponsorProposals } from "./sponsor-proposals";

describe("generateSponsorProposals", () => {
  it("priorise les sponsors nationaux disponibles", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "FR",
      directorReputation: 100,
    });

    expect(proposals).toHaveLength(3);

    expect(
      proposals.every(
        (proposal) => proposal.sponsor.countryCode === "FR"
      )
    ).toBe(true);
  });

  it("priorise les sponsors néerlandais pour un directeur néerlandais", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "NL",
      directorReputation: 100,
    });

    expect(proposals).toHaveLength(3);

    expect(
      proposals.every(
        (proposal) => proposal.sponsor.countryCode === "NL"
      )
    ).toBe(true);
  });

  it("priorise les sponsors italiens pour un directeur italien", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "IT",
      directorReputation: 100,
    });

    expect(proposals).toHaveLength(3);

    expect(
      proposals.every(
        (proposal) => proposal.sponsor.countryCode === "IT"
      )
    ).toBe(true);
  });

  it.each(["MA", "SN", "CI", "NG", "CM", "KE", "ET", "RW", "ZA", "MG", "GR", "US", "EE", "LV", "LT"])(
    "propose d’abord un sponsor national pour un directeur %s",
    (directorCountryCode) => {
      const proposals = generateSponsorProposals({
        directorCountryCode,
        directorReputation: 100,
      });

      expect(proposals).toHaveLength(3);
      expect(proposals[0]?.sponsor.countryCode).toBe(
        directorCountryCode
      );
    }
  );

  it("propose des sponsors de pays voisins sans sponsor national", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "LU",
      directorReputation: 100,
    });

    expect(proposals).toHaveLength(3);

    expect(
      proposals.every((proposal) =>
        ["BE", "DE", "FR"].includes(
          proposal.sponsor.countryCode
        )
      )
    ).toBe(true);
  });

  it("exclut les sponsors indisponibles", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "FR",
      directorReputation: 100,
      unavailableSponsorIds: [
        "veloria-mobilites",
        "terroirs-unis",
        "nova-assurances",
      ],
    });

    const proposedSponsorIds = proposals.map(
      (proposal) => proposal.sponsor.id
    );

    expect(proposedSponsorIds).not.toContain(
      "veloria-mobilites"
    );
    expect(proposedSponsorIds).not.toContain("terroirs-unis");
    expect(proposedSponsorIds).not.toContain("nova-assurances");
  });

  it("respecte la réputation minimale des sponsors", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "FR",
      directorReputation: 0,
    });

    expect(
      proposals.every(
        (proposal) =>
          proposal.sponsor.minimumReputation <= 0
      )
    ).toBe(true);

    expect(
      proposals.some(
        (proposal) =>
          proposal.sponsor.id === "nova-assurances"
      )
    ).toBe(false);
  });

  it("génère des budgets et durées dans les fourchettes prévues", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "FR",
      directorReputation: 100,
    });

    for (const proposal of proposals) {
      expect(proposal.proposedBudget).toBeGreaterThanOrEqual(
        proposal.sponsor.budgetRange.min
      );

      expect(proposal.proposedBudget).toBeLessThanOrEqual(
        proposal.sponsor.budgetRange.max
      );

      expect(proposal.proposedBudget % 10_000).toBe(0);

      expect(
        proposal.contractDurationSeasons
      ).toBeGreaterThanOrEqual(
        proposal.sponsor.contractDurationRange.min
      );

      expect(
        proposal.contractDurationSeasons
      ).toBeLessThanOrEqual(
        proposal.sponsor.contractDurationRange.max
      );
    }
  });

  it("retourne un tableau vide si aucune proposition n’est demandée", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "FR",
      directorReputation: 100,
      proposalCount: 0,
    });

    expect(proposals).toEqual([]);
  });
});
