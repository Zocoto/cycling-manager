import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  buildSponsorBudgetHistory,
  selectSponsorBudgetHistoryContract,
  type SponsorBudgetHistoryPoint,
} from "@/lib/game/sponsor-budget-history";
import {readSponsorSeasonReviewObjective, type SponsorSeasonReview, readSponsorReviewNumber} from "@/lib/game/sponsor-season-review";
import type {SponsorObjectiveStatus, SponsorObjectiveTargetDetails} from "@/types/sponsor-objective";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamSeasonRow = {
  season_id: string;
  display_name: string;
  operating_budget: number | string;
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
  sponsor_offer_id: string | null;
  objective_season_id: string | null;
  satisfaction_score: number | null;
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
  sponsor_offer_id: string | null;
  satisfaction_score: number | null;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function getSponsorBudgetHistoryForTeam(
  teamId: string,
  supabase: SupabaseAdminClient = createSupabaseAdminClient(),
): Promise<SponsorBudgetHistoryPoint[]> {
  return (await loadSponsorHistory(teamId, supabase, false)).budgetHistory;
}

export async function getSponsorHistoryForTeam(
  teamId: string,
  supabase: SupabaseAdminClient = createSupabaseAdminClient(),
) {
  return loadSponsorHistory(teamId, supabase, true);
}

async function loadSponsorHistory(teamId: string, supabase: SupabaseAdminClient, includeReview: boolean): Promise<{
  budgetHistory: SponsorBudgetHistoryPoint[]; previousSeasonReview: SponsorSeasonReview | null;
}> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) return {budgetHistory: [], previousSeasonReview: null};

  const [teamSeasonsResult, contractsResult] = await Promise.all([
    supabase
      .from("team_seasons")
      .select("season_id, display_name, operating_budget")
      .eq("team_id", normalizedTeamId)
      .neq("status", "withdrawn")
      .returns<TeamSeasonRow[]>(),
    supabase
      .from("team_sponsor_contracts")
      .select(
        "id, sponsor_id, start_season_id, end_season_id, budget_per_season, currency_code, status, created_at, sponsor_offer_id, objective_season_id, satisfaction_score",
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

  if (teamSeasons.length === 0) return {budgetHistory: [], previousSeasonReview: null};

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
              "team_sponsor_contract_id, season_id, budget_per_season, sponsor_offer_id, satisfaction_score",
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

  const historyContracts = contracts.map((contract) => ({
    id: contract.id, sponsorId: contract.sponsor_id, startSeasonId: contract.start_season_id,
    endSeasonId: contract.end_season_id, budgetPerSeason: Number(contract.budget_per_season),
    currencyCode: contract.currency_code, status: contract.status, createdAt: contract.created_at,
  }));
  const budgetHistory = buildSponsorBudgetHistory({
    teamSeasons: teamSeasons.map((teamSeason) => ({
      seasonId: teamSeason.season_id,
      displayName: teamSeason.display_name,
      operatingBudget: Number(teamSeason.operating_budget),
    })),
    seasons: (seasonsResult.data ?? []).map((season) => ({
      id: season.id,
      name: season.name,
      gameYear: season.game_year,
      status: season.status,
    })),
    contracts: historyContracts,
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
  const currentSeason = (seasonsResult.data ?? []).find(season=>season.status === "active");
  const previous = currentSeason ? budgetHistory.find(point=>point.gameYear === currentSeason.game_year - 1) : null;
  if (!includeReview || !currentSeason || !previous?.logo || previous.budgetPerSeason <= 0) {
    return {budgetHistory, previousSeasonReview: null};
  }
  const years = new Map((seasonsResult.data ?? []).map(season=>[season.id, season.game_year]));
  const previousContract = selectSponsorBudgetHistoryContract(historyContracts, previous.gameYear, years);
  const currentContract = selectSponsorBudgetHistoryContract(historyContracts, currentSeason.game_year, years);
  const persisted = contracts.find(contract=>contract.id === previousContract?.id);
  if (!persisted) return {budgetHistory, previousSeasonReview: null};
  const archive = (annualBudgetsResult.data ?? []).find(row=>row.team_sponsor_contract_id === persisted.id && row.season_id === previous.seasonId);
  const stillPreviousSeason = (persisted.objective_season_id ?? persisted.start_season_id) === previous.seasonId;
  const offerId = archive?.sponsor_offer_id ?? (stillPreviousSeason ? persisted.sponsor_offer_id : null);
  const score = readSponsorReviewNumber(archive ? archive.satisfaction_score : stillPreviousSeason ? persisted.satisfaction_score : null);
  const current = budgetHistory.find(point=>point.seasonId === currentSeason.id);
  const previousSeasonReview: SponsorSeasonReview = {
    gameYear: previous.gameYear, currentGameYear: currentSeason.game_year, sponsorName: previous.logo.sponsorName,
    currentSponsorName: current?.logo?.sponsorName ?? null, sameContract: currentContract?.id === persisted.id,
    satisfactionScore: score === null ? null : Math.max(0, Math.min(100, score)),
    previousBudget: previous.budgetPerSeason, currentBudget: current?.budgetPerSeason ?? null,
    currencyCode: previous.currencyCode, currentCurrencyCode: current?.currencyCode ?? previous.currencyCode,
    objectives: [], objectivesAvailable: false,
  };
  if (offerId) {
    try {
      // One bounded read for the entire archived plan; no evaluation or per-objective queries.
      const result = await supabase.from("sponsor_objectives")
        .select("id, name, display_order, status, satisfaction_points, target_details, objective_progress(current_value, status, details)")
        .eq("sponsor_offer_id", offerId).eq("season_id", previous.seasonId)
        .eq("objective_progress.team_sponsor_contract_id", persisted.id)
        .eq("objective_progress.season_id", previous.seasonId)
        .order("display_order", {ascending: true}).limit(50)
        .limit(1, {referencedTable: "objective_progress"})
        .abortSignal(AbortSignal.timeout(3000)).returns<ReviewObjectiveRow[]>();
      if (result.error) throw result.error;
      previousSeasonReview.objectives = (result.data ?? []).map(readSponsorSeasonReviewObjective);
      previousSeasonReview.objectivesAvailable = previousSeasonReview.objectives.length > 0;
    } catch (error) {
      console.error("sponsor_previous_season_review_unavailable", error instanceof Error ? error.message : "read failed");
    }
  }
  return {budgetHistory, previousSeasonReview};
}

type ReviewObjectiveRow = {
  id: string; name: string; display_order: number; status: SponsorObjectiveStatus;
  satisfaction_points: number; target_details: SponsorObjectiveTargetDetails;
  objective_progress: {current_value: number | string | null; status: string; details: Record<string, unknown> | null}[] | null;
};

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
