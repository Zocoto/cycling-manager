import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationTreasuryTransaction = {
  id: string;
  dayNumber: number;
  amount: number;
  category: string;
  description: string;
  createdAt: string;
};

export type FederationTreasuryState = {
  account: {
    id: string;
    openingBalance: number;
    balance: number;
    sourceGameYear: number;
    uciRank: number;
    nationsCupDivision: number;
    objectiveLevel: "none" | "bronze" | "silver" | "gold";
    objectiveCompletedCount: number;
    objectiveBonus: number;
    openingBreakdown: {
      commonGrant: number;
      uciGrant: number;
      nationsCupGrant: number;
      raceRevenue: number;
      completedRaceDays: number;
      averageStarters: number;
    } | null;
  } | null;
  canDonate: boolean;
  canManageSolidarity: boolean;
  solidarityLimit: number;
  solidarityDistributed: number;
  solidarityRemaining: number;
  solidarityPlanCount: number;
  transactions: FederationTreasuryTransaction[];
};

type AccountRow = {
  id: string;
  opening_balance: number | string;
  balance: number | string;
  source_game_year: number;
  uci_rank: number;
  nations_cup_division: number;
  objective_level: "none" | "bronze" | "silver" | "gold";
  objective_completed_count: number;
  objective_bonus: number | string;
};
type TransactionRow = {
  id: string;
  day_number: number;
  amount: number | string;
  category: string;
  description: string;
  created_at: string;
};
type OpeningTransactionRow = {
  metadata: unknown;
};
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type SolidarityPlanRow = { total_amount: number | string };

export async function getFederationTreasuryState({
  countryId,
  seasonId,
  gameYear,
  viewerTeamId,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  viewerTeamId: string | null;
}): Promise<FederationTreasuryState> {
  const empty: FederationTreasuryState = {
    account: null,
    canDonate: false,
    canManageSolidarity: false,
    solidarityLimit: 0,
    solidarityDistributed: 0,
    solidarityRemaining: 0,
    solidarityPlanCount: 0,
    transactions: [],
  };
  try {
    const admin = createSupabaseAdminClient();
    const [accountResult, assignmentResult, termResult] = await Promise.all([
      admin
        .from("national_federation_accounts")
        .select(
          "id, opening_balance, balance, source_game_year, uci_rank, nations_cup_division, objective_level, objective_completed_count, objective_bonus",
        )
        .eq("country_id", countryId)
        .eq("season_id", seasonId)
        .maybeSingle<AccountRow>(),
      viewerTeamId
        ? admin
            .from("team_manager_assignments")
            .select("sporting_director_id")
            .eq("team_id", viewerTeamId)
            .eq("role", "general_manager")
            .eq("status", "active")
            .maybeSingle<AssignmentRow>()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("national_federation_terms")
        .select("president_director_id")
        .eq("country_id", countryId)
        .lte("start_game_year", gameYear)
        .gte("end_game_year", gameYear)
        .maybeSingle<TermRow>(),
    ]);
    if (accountResult.error) throw accountResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    if (termResult.error) throw termResult.error;

    const account = accountResult.data;
    if (!account) {
      return { ...empty, canDonate: gameYear >= 3 && Boolean(viewerTeamId) };
    }
    const [transactionsResult, solidarityResult, openingTransactionResult] = await Promise.all([
      admin
        .from("national_federation_transactions")
        .select("id, day_number, amount, category, description, created_at")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<TransactionRow[]>(),
      admin
        .from("national_federation_solidarity_plans")
        .select("total_amount")
        .eq("account_id", account.id)
        .returns<SolidarityPlanRow[]>(),
      admin
        .from("national_federation_transactions")
        .select("metadata")
        .eq("account_id", account.id)
        .eq("category", "opening_grant")
        .maybeSingle<OpeningTransactionRow>(),
    ]);
    if (transactionsResult.error) throw transactionsResult.error;
    if (solidarityResult.error) throw solidarityResult.error;
    if (openingTransactionResult.error) throw openingTransactionResult.error;

    const viewerDirectorId = assignmentResult.data?.sporting_director_id ?? null;
    const solidarityLimit = Number(account.opening_balance) * 0.1;
    const solidarityDistributed = (solidarityResult.data ?? []).reduce(
      (total, plan) => total + Number(plan.total_amount),
      0,
    );
    return {
      account: {
        id: account.id,
        openingBalance: Number(account.opening_balance),
        balance: Number(account.balance),
        sourceGameYear: account.source_game_year,
        uciRank: account.uci_rank,
        nationsCupDivision: account.nations_cup_division,
        objectiveLevel: account.objective_level,
        objectiveCompletedCount: account.objective_completed_count,
        objectiveBonus: Number(account.objective_bonus),
        openingBreakdown: parseOpeningBreakdown(
          openingTransactionResult.data?.metadata,
        ),
      },
      canDonate: gameYear >= 3 && Boolean(viewerTeamId),
      canManageSolidarity:
        gameYear >= 3 &&
        Boolean(viewerDirectorId) &&
        viewerDirectorId === termResult.data?.president_director_id,
      solidarityLimit,
      solidarityDistributed,
      solidarityRemaining: Math.max(0, solidarityLimit - solidarityDistributed),
      solidarityPlanCount: solidarityResult.data?.length ?? 0,
      transactions: (transactionsResult.data ?? []).map((transaction) => ({
        id: transaction.id,
        dayNumber: transaction.day_number,
        amount: Number(transaction.amount),
        category: transaction.category,
        description: transaction.description,
        createdAt: transaction.created_at,
      })),
    };
  } catch (error) {
    console.error("Impossible de charger la trésorerie fédérale :", error);
    return empty;
  }
}

function parseOpeningBreakdown(
  value: unknown,
): NonNullable<
  NonNullable<FederationTreasuryState["account"]>["openingBreakdown"]
> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  const commonGrant = finiteNumber(metadata.commonGrant);
  const uciGrant = finiteNumber(metadata.uciGrant);
  const nationsCupGrant = finiteNumber(metadata.nationsCupGrant);
  const raceRevenue = finiteNumber(metadata.raceRevenue);
  const completedRaceDays = finiteNumber(metadata.completedRaceDays);
  const averageStarters = finiteNumber(metadata.averageStarters);
  if (
    commonGrant == null ||
    uciGrant == null ||
    nationsCupGrant == null ||
    raceRevenue == null ||
    completedRaceDays == null ||
    averageStarters == null
  ) {
    return null;
  }
  return {
    commonGrant,
    uciGrant,
    nationsCupGrant,
    raceRevenue,
    completedRaceDays,
    averageStarters,
  };
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
