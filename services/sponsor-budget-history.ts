import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  buildSponsorBudgetHistory,
  type SponsorBudgetHistoryPoint,
} from "@/lib/game/sponsor-budget-history";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamSeasonRow = {
  season_id: string;
  display_name: string;
};

type SponsorContractRow = {
  id: string;
  sponsor_id: string;
  start_season_id: string;
  end_season_id: string | null;
  budget_per_season: number | string;
  currency_code: string;
  status: string;
  created_at: string;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  status: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

type AnnualBudgetRow = {
  team_sponsor_contract_id: string;
  season_id: string;
  budget_per_season: number | string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function getSponsorBudgetHistoryForTeam(
  teamId: string,
  supabase: SupabaseAdminClient = createSupabaseAdminClient(),
): Promise<SponsorBudgetHistoryPoint[]> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) return [];

  const [teamSeasonsResult, contractsResult] = await Promise.all([
    supabase
      .from("team_seasons")
      .select("season_id, display_name")
      .eq("team_id", normalizedTeamId)
      .neq("status", "withdrawn")
      .returns<TeamSeasonRow[]>(),
    supabase
      .from("team_sponsor_contracts")
      .select(
        "id, sponsor_id, start_season_id, end_season_id, budget_per_season, currency_code, status, created_at",
      )
      .eq("team_id", normalizedTeamId)
      .eq("role", "principal")
      .in("status", ["active", "completed", "terminated"])
      .returns<SponsorContractRow[]>(),
  ]);

  assertQuery(teamSeasonsResult.error, "les saisons historiques de l’équipe");
  assertQuery(contractsResult.error, "les contrats sponsors historiques");

  const teamSeasons = teamSeasonsResult.data ?? [];
  const contracts = contractsResult.data ?? [];

  if (teamSeasons.length === 0) return [];

  const teamSeasonIds = unique(teamSeasons.map((entry) => entry.season_id));
  const contractSeasonIds = unique(
    contracts.flatMap((contract) => [
      contract.start_season_id,
      contract.end_season_id,
    ]),
  );
  const seasonIds = unique([...teamSeasonIds, ...contractSeasonIds]);
  const contractIds = contracts.map((contract) => contract.id);
  const sponsorIds = unique(contracts.map((contract) => contract.sponsor_id));

  const [seasonsResult, sponsorRegistryResult, annualBudgetsResult] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("id, name, game_year, status")
        .in("id", seasonIds)
        .returns<SeasonRow[]>(),
      sponsorIds.length > 0
        ? supabase
            .from("sponsors")
            .select("id, catalog_key")
            .in("id", sponsorIds)
            .returns<SponsorRegistryRow[]>()
        : Promise.resolve({ data: [] as SponsorRegistryRow[], error: null }),
      contractIds.length > 0
        ? supabase
            .from("sponsor_annual_objective_history")
            .select(
              "team_sponsor_contract_id, season_id, budget_per_season",
            )
            .in("team_sponsor_contract_id", contractIds)
            .in("season_id", teamSeasonIds)
            .returns<AnnualBudgetRow[]>()
        : Promise.resolve({ data: [] as AnnualBudgetRow[], error: null }),
    ]);

  assertQuery(seasonsResult.error, "les saisons du jeu");
  assertQuery(sponsorRegistryResult.error, "les sponsors historiques");
  assertQuery(annualBudgetsResult.error, "les budgets sponsors annualisés");

  const catalogSponsorByKey = new Map(
    SPONSORS.map((sponsor) => [sponsor.id, sponsor]),
  );

  return buildSponsorBudgetHistory({
    teamSeasons: teamSeasons.map((teamSeason) => ({
      seasonId: teamSeason.season_id,
      displayName: teamSeason.display_name,
    })),
    seasons: (seasonsResult.data ?? []).map((season) => ({
      id: season.id,
      name: season.name,
      gameYear: season.game_year,
      status: season.status,
    })),
    contracts: contracts.map((contract) => ({
      id: contract.id,
      sponsorId: contract.sponsor_id,
      startSeasonId: contract.start_season_id,
      endSeasonId: contract.end_season_id,
      budgetPerSeason: Number(contract.budget_per_season),
      currencyCode: contract.currency_code,
      status: contract.status,
      createdAt: contract.created_at,
    })),
    annualBudgets: (annualBudgetsResult.data ?? []).map((budget) => ({
      contractId: budget.team_sponsor_contract_id,
      seasonId: budget.season_id,
      budgetPerSeason: Number(budget.budget_per_season),
    })),
    sponsors: (sponsorRegistryResult.data ?? []).flatMap((registrySponsor) => {
      const sponsor = catalogSponsorByKey.get(registrySponsor.catalog_key);

      if (!sponsor) return [];

      return [
        {
          id: registrySponsor.id,
          logo: {
            sponsorName: sponsor.name,
            logoPath: sponsor.logoPath,
            primaryColor: sponsor.colors.primary,
            backgroundColor: sponsor.colors.background,
            textColor: sponsor.colors.text,
          },
        },
      ];
    }),
  });
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function assertQuery(
  error: { message: string } | null,
  resourceLabel: string,
): void {
  if (error) {
    throw new Error(`Impossible de charger ${resourceLabel} : ${error.message}`);
  }
}
