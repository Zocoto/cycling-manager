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
  } | null;
  canDonate: boolean;
  canManageSolidarity: boolean;
  solidarityExecuted: boolean;
  transactions: FederationTreasuryTransaction[];
};

type AccountRow = {
  id: string;
  opening_balance: number | string;
  balance: number | string;
  source_game_year: number;
  uci_rank: number;
  nations_cup_division: number;
};
type TransactionRow = {
  id: string;
  day_number: number;
  amount: number | string;
  category: string;
  description: string;
  created_at: string;
};
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };

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
    solidarityExecuted: false,
    transactions: [],
  };
  try {
    const admin = createSupabaseAdminClient();
    const [accountResult, assignmentResult, termResult] = await Promise.all([
      admin
        .from("national_federation_accounts")
        .select(
          "id, opening_balance, balance, source_game_year, uci_rank, nations_cup_division",
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
    const [transactionsResult, solidarityResult] = await Promise.all([
      admin
        .from("national_federation_transactions")
        .select("id, day_number, amount, category, description, created_at")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<TransactionRow[]>(),
      admin
        .from("national_federation_solidarity_plans")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id),
    ]);
    if (transactionsResult.error) throw transactionsResult.error;
    if (solidarityResult.error) throw solidarityResult.error;

    const viewerDirectorId = assignmentResult.data?.sporting_director_id ?? null;
    return {
      account: {
        id: account.id,
        openingBalance: Number(account.opening_balance),
        balance: Number(account.balance),
        sourceGameYear: account.source_game_year,
        uciRank: account.uci_rank,
        nationsCupDivision: account.nations_cup_division,
      },
      canDonate: gameYear >= 3 && Boolean(viewerTeamId),
      canManageSolidarity:
        gameYear >= 3 &&
        Boolean(viewerDirectorId) &&
        viewerDirectorId === termResult.data?.president_director_id,
      solidarityExecuted: (solidarityResult.count ?? 0) > 0,
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
