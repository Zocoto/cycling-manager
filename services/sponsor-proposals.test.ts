import { describe, expect, it } from "vitest";

import {
  applySponsorPhilosophyBudgetBonus,
  generateSponsorProposals,
} from "./sponsor-proposals";

describe("generateSponsorProposals", () => {
  it("fait du pays de l'équipe le premier critère, indépendamment du pays du DS", () => {
    const argentinaProposals = generateSponsorProposals({
      teamCountryCode: "AR",
      directorCountryCode: "FR",
      directorReputation: 100,
      random: () => 0.5,
    });
    const yemenProposals = generateSponsorProposals({
      teamCountryCode: "YE",
      directorCountryCode: "LS",
      directorReputation: 130,
      random: () => 0.5,
    });

    expect(argentinaProposals[0]?.sponsor.id).toBe("fugazza-sprint");
    expect(yemenProposals[0]?.sponsor.id).toBe(
      "aden-maritime-exchange",
    );
  });

  it("complète l'offre nationale avec les pays des leaders puis de l'effectif majoritaire", () => {
    const proposals = generateSponsorProposals({
      teamCountryCode: "AR",
      leaderCountryCodes: ["ES"],
      rosterMajorityCountryCode: "IT",
      directorCountryCode: "FR",
      directorReputation: 100,
      random: () => 0.5,
    });

    expect(proposals.map((proposal) => proposal.sponsor.countryCode)).toEqual([
      "AR",
      "ES",
      "IT",
    ]);
  });

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

  it.each(["SN", "CM", "KE", "ZA", "MG", "GR", "US", "EE", "LV"])(
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

  it.each([
    [99, 2],
    [100, 3],
    [499, 3],
    [500, 4],
    [999, 4],
    [1_000, 5],
  ])(
    "plafonne le prestige ? %i ?toiles pour %i points de r?putation",
    (directorReputation, maximumPrestige) => {
      const proposals = generateSponsorProposals({
        directorCountryCode: "BE",
        directorReputation,
        proposalCount: 30,
        random: () => 0.5,
      });

      expect(proposals.length).toBeGreaterThan(0);
      expect(
        Math.max(
          ...proposals.map((proposal) => proposal.sponsor.prestige)
        )
      ).toBeLessThanOrEqual(maximumPrestige);
    }
  );

  it("ne propose aucun sponsor 5/5 ? 70 de r?putation", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 70,
      proposalCount: 100,
      random: () => 0.5,
    });

    expect(
      proposals.some((proposal) => proposal.sponsor.prestige === 5)
    ).toBe(false);
  });

  it("ouvre les sponsors 5/5 ? partir de 1000", () => {
    const proposals = generateSponsorProposals({
      directorCountryCode: "BE",
      directorReputation: 1_000,
      proposalCount: 100,
      random: () => 0.5,
      });

    expect(
      proposals.some((proposal) => proposal.sponsor.prestige === 5)
    ).toBe(true);
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

      const maximumBudget = applySponsorPhilosophyBudgetBonus(
        proposal.sponsor.budgetRange.max,
        proposal.sponsor.id === "terroirs-unis"
          ? "national_preference"
          : "cobbled_classics",
      );
      expect(proposal.proposedBudget).toBeLessThanOrEqual(maximumBudget);

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

  it("majore de 15 % et arrondit au palier financier les offres nationales", () => {
    expect(
      applySponsorPhilosophyBudgetBonus(1_000_000, "national_preference"),
    ).toBe(1_150_000);
    expect(
      applySponsorPhilosophyBudgetBonus(1_000_000, "youth_development"),
    ).toBe(1_000_000);
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
