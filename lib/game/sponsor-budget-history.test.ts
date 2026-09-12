import { describe, expect, it } from "vitest";

import { buildSponsorBudgetHistory } from "@/lib/game/sponsor-budget-history";

const seasons = [
  { id: "s1", name: "Saison 1", gameYear: 1, status: "completed" },
  { id: "s2", name: "Saison 2", gameYear: 2, status: "completed" },
  { id: "s3", name: "Saison 3", gameYear: 3, status: "active" },
  { id: "s4", name: "Saison 4", gameYear: 4, status: "planned" },
];

describe("buildSponsorBudgetHistory", () => {
  it("conserve chaque saison jouée, valorise l’amateur à zéro et utilise le budget annuel archivé", () => {
    const result = buildSponsorBudgetHistory({
      teamSeasons: [
        {
          seasonId: "s1",
          displayName: "Vélo Club Horizon",
          operatingBudget: 0,
        },
        {
          seasonId: "s2",
          displayName: "Atlas Horizon",
          operatingBudget: 2_700_000,
        },
        {
          seasonId: "s3",
          displayName: "Atlas Horizon Pro",
          operatingBudget: 3_200_000,
        },
        {
          seasonId: "s4",
          displayName: "Atlas Horizon Pro",
          operatingBudget: 3_200_000,
        },
      ],
      seasons,
      contracts: [
        {
          id: "contract-atlas",
          sponsorId: "sponsor-atlas",
          startSeasonId: "s2",
          endSeasonId: "s3",
          budgetPerSeason: 3_200_000,
          currencyCode: "EUR",
          status: "active",
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      ],
      annualBudgets: [
        {
          contractId: "contract-atlas",
          seasonId: "s2",
          budgetPerSeason: 2_700_000,
        },
      ],
      sponsors: [
        {
          id: "sponsor-atlas",
          logo: {
            sponsorName: "Atlas",
            logoPath: "/images/sponsors/atlas/logo.webp",
            primaryColor: "#123456",
            backgroundColor: "#FFFFFF",
            textColor: "#123456",
          },
        },
      ],
    });

    expect(result).toHaveLength(3);
    expect(result.map((point) => point.gameYear)).toEqual([1, 2, 3]);
    expect(result.map((point) => point.budgetPerSeason)).toEqual([
      0,
      2_700_000,
      3_200_000,
    ]);
    expect(result[0]).toMatchObject({
      teamName: "Vélo Club Horizon",
      logo: null,
    });
    expect(result[2]).toMatchObject({
      teamName: "Atlas Horizon Pro",
      logo: { sponsorName: "Atlas" },
    });
  });

  it("privilégie le contrat actif lorsqu’un ancien contrat terminé couvre la même saison", () => {
    const result = buildSponsorBudgetHistory({
      teamSeasons: [
        {
          seasonId: "s3",
          displayName: "Nouvelle Équipe",
          operatingBudget: 4_000_000,
        },
      ],
      seasons,
      contracts: [
        {
          id: "old-contract",
          sponsorId: "old-sponsor",
          startSeasonId: "s2",
          endSeasonId: "s3",
          budgetPerSeason: 1_000_000,
          currencyCode: "EUR",
          status: "terminated",
          createdAt: "2026-08-01T10:00:00.000Z",
        },
        {
          id: "new-contract",
          sponsorId: "new-sponsor",
          startSeasonId: "s3",
          endSeasonId: "s4",
          budgetPerSeason: 4_000_000,
          currencyCode: "EUR",
          status: "active",
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      ],
      annualBudgets: [],
      sponsors: [],
    });

    expect(result[0]?.budgetPerSeason).toBe(4_000_000);
  });

  it("utilise le budget figé de la saison si l’archive annuelle manque", () => {
    const result = buildSponsorBudgetHistory({
      teamSeasons: [
        {
          seasonId: "s2",
          displayName: "Abbaye du Lion",
          operatingBudget: 670_000,
        },
        {
          seasonId: "s3",
          displayName: "Abbaye du Lion",
          operatingBudget: 696_800,
        },
      ],
      seasons,
      contracts: [
        {
          id: "contract-abbaye",
          sponsorId: "sponsor-abbaye",
          startSeasonId: "s2",
          endSeasonId: "s3",
          budgetPerSeason: 696_800,
          currencyCode: "EUR",
          status: "active",
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      ],
      annualBudgets: [],
      sponsors: [],
    });

    expect(result.map((point) => point.budgetPerSeason)).toEqual([
      670_000,
      696_800,
    ]);
  });
});
