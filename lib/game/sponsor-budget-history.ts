import { isGameYearCoveredBySponsorContract } from "@/lib/game/team-sponsor-history";

export type SponsorBudgetHistoryLogo = {
  sponsorName: string;
  logoPath: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

export type SponsorBudgetHistoryPoint = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  teamName: string;
  budgetPerSeason: number;
  currencyCode: string;
  logo: SponsorBudgetHistoryLogo | null;
};

export type SponsorBudgetHistoryTeamSeason = {
  seasonId: string;
  displayName: string;
  operatingBudget: number;
};

export type SponsorBudgetHistorySeason = {
  id: string;
  name: string;
  gameYear: number;
  status: string;
};

export type SponsorBudgetHistoryContract = {
  id: string;
  sponsorId: string;
  startSeasonId: string;
  endSeasonId: string | null;
  budgetPerSeason: number;
  currencyCode: string;
  status: string;
  createdAt: string;
};

export type SponsorBudgetHistoryAnnualBudget = {
  contractId: string;
  seasonId: string;
  budgetPerSeason: number;
};

export type SponsorBudgetHistorySponsor = {
  id: string;
  logo: SponsorBudgetHistoryLogo;
};

export function buildSponsorBudgetHistory({
  teamSeasons,
  seasons,
  contracts,
  annualBudgets,
  sponsors,
}: {
  teamSeasons: SponsorBudgetHistoryTeamSeason[];
  seasons: SponsorBudgetHistorySeason[];
  contracts: SponsorBudgetHistoryContract[];
  annualBudgets: SponsorBudgetHistoryAnnualBudget[];
  sponsors: SponsorBudgetHistorySponsor[];
}): SponsorBudgetHistoryPoint[] {
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const yearBySeasonId = new Map(
    seasons.map((season) => [season.id, season.gameYear]),
  );
  const sponsorById = new Map(sponsors.map((sponsor) => [sponsor.id, sponsor]));
  const annualBudgetByContractAndSeason = new Map(
    annualBudgets.map((budget) => [
      `${budget.contractId}:${budget.seasonId}`,
      budget.budgetPerSeason,
    ]),
  );

  return teamSeasons
    .flatMap<SponsorBudgetHistoryPoint>((teamSeason) => {
      const season = seasonById.get(teamSeason.seasonId);

      if (!season || !["active", "completed"].includes(season.status)) {
        return [];
      }

      const contract = contracts
        .filter((candidate) =>
          isGameYearCoveredBySponsorContract({
            gameYear: season.gameYear,
            startGameYear: yearBySeasonId.get(candidate.startSeasonId),
            endGameYear: candidate.endSeasonId
              ? yearBySeasonId.get(candidate.endSeasonId)
              : null,
          }),
        )
        .sort(compareContracts)[0];
      const archivedBudget = contract
        ? annualBudgetByContractAndSeason.get(`${contract.id}:${season.id}`)
        : undefined;
      const budgetPerSeason = normalizeBudget(
        archivedBudget ??
          (contract
            ? normalizeBudget(teamSeason.operatingBudget) ||
              contract.budgetPerSeason
            : 0),
      );

      return [
        {
          seasonId: season.id,
          seasonName: season.name,
          gameYear: season.gameYear,
          teamName: teamSeason.displayName,
          budgetPerSeason,
          currencyCode: contract?.currencyCode || "EUR",
          logo: contract ? sponsorById.get(contract.sponsorId)?.logo ?? null : null,
        },
      ];
    })
    .sort((left, right) => left.gameYear - right.gameYear);
}

function compareContracts(
  left: SponsorBudgetHistoryContract,
  right: SponsorBudgetHistoryContract,
): number {
  const priorityDifference =
    contractStatusPriority(right.status) - contractStatusPriority(left.status);

  if (priorityDifference !== 0) return priorityDifference;

  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function contractStatusPriority(status: string): number {
  if (status === "active") return 3;
  if (status === "completed") return 2;
  if (status === "terminated") return 1;
  return 0;
}

function normalizeBudget(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
