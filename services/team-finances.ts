import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildFinanceProjection,
  type FinanceChartPoint,
  type TeamDivisionCode,
} from "@/lib/game/economy";
import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  opening_cash_balance: number | string;
  cash_balance: number | string;
  currency: string;
  points: number;
  final_rank: number | null;
  division_id: string | null;
};
type RankingTeamRow = { id: string; display_name: string; points: number };
type DivisionRow = { code: string };
type TransactionRow = {
  id: string;
  day_number: number;
  amount: number | string;
  category: FinanceCategory;
  status: "pending" | "posted" | "cancelled";
  description: string;
  posted_at: string | null;
};
type AlertRow = {
  id: string;
  checkpoint_day_number: number;
  balance: number | string;
  severity: "warning" | "critical" | "forced_recovery";
  reputation_penalty: number;
  message: string;
};

export type FinanceCategory =
  | "sponsor"
  | "race_prize"
  | "rider_salary"
  | "staff_salary"
  | "equipment"
  | "building"
  | "transfer"
  | "training"
  | "other";

export type TeamFinanceTransaction = {
  id: string;
  dayNumber: number;
  amount: number;
  category: FinanceCategory;
  status: "pending" | "posted" | "cancelled";
  description: string;
  postedAt: string | null;
};

export type TeamFinanceAlert = {
  id: string;
  checkpointDayNumber: number;
  balance: number;
  severity: "warning" | "critical" | "forced_recovery";
  reputationPenalty: number;
  message: string;
};

export type TeamFinanceOverview = {
  teamId: string;
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  currency: string;
  balance: number;
  projectedBalance: number;
  totalIncome: number;
  totalExpenses: number;
  canSpend: boolean;
  teamPoints: number;
  teamRank: number | null;
  divisionCode: TeamDivisionCode;
  divisionName: string;
  chart: FinanceChartPoint[];
  transactions: TeamFinanceTransaction[];
  alerts: TeamFinanceAlert[];
};

export async function getCurrentTeamFinanceOverview(
  supabase: SupabaseServerClient,
  authUserId: string
): Promise<TeamFinanceOverview | null> {
  const settlement = await supabase.rpc("settle_current_team_finances");

  if (settlement.error) {
    throw new Error(
      `Impossible de mettre à jour la trésorerie : ${settlement.error.message}`
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();

  assertQuery(directorError, "le Directeur Sportif");

  if (!director) {
    return null;
  }

  const [{ data: assignment, error: assignmentError }, { data: season, error: seasonError }] =
    await Promise.all([
      admin
        .from("team_manager_assignments")
        .select("team_id")
        .eq("sporting_director_id", director.id)
        .eq("role", "general_manager")
        .eq("status", "active")
        .maybeSingle<AssignmentRow>(),
      admin
        .from("seasons")
        .select("id, name, current_day_number")
        .eq("status", "active")
        .maybeSingle<SeasonRow>(),
    ]);

  assertQuery(assignmentError, "l’affectation à l’équipe");
  assertQuery(seasonError, "la saison active");

  if (!assignment || !season) {
    return null;
  }

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select(
      "id, team_id, display_name, opening_cash_balance, cash_balance, currency, points, final_rank, division_id"
    )
    .eq("team_id", assignment.team_id)
    .eq("season_id", season.id)
    .maybeSingle<TeamSeasonRow>();

  assertQuery(teamSeasonError, "les finances de l’équipe");

  if (!teamSeason) {
    return null;
  }

  const [transactionsResult, alertsResult, rankingTeamsResult, divisionResult] = await Promise.all([
    admin
      .from("team_finance_transactions")
      .select("id, day_number, amount, category, status, description, posted_at")
      .eq("team_season_id", teamSeason.id)
      .order("day_number", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<TransactionRow[]>(),
    admin
      .from("team_finance_alerts")
      .select(
        "id, checkpoint_day_number, balance, severity, reputation_penalty, message"
      )
      .eq("team_season_id", teamSeason.id)
      .order("checkpoint_day_number", { ascending: false })
      .returns<AlertRow[]>(),
    admin
      .from("team_seasons")
      .select("id, display_name, points")
      .eq("season_id", season.id)
      .neq("status", "withdrawn")
      .returns<RankingTeamRow[]>(),
    teamSeason.division_id
      ? admin
          .from("divisions")
          .select("code")
          .eq("id", teamSeason.division_id)
          .maybeSingle<DivisionRow>()
      : Promise.resolve({ data: null as DivisionRow | null, error: null }),
  ]);

  assertQuery(transactionsResult.error, "le registre financier");
  assertQuery(alertsResult.error, "les alertes financières");
  assertQuery(rankingTeamsResult.error, "le classement de l’équipe");
  assertQuery(divisionResult.error, "la division de l’équipe");

  const transactions = (transactionsResult.data ?? []).map(toTransaction);
  const activeTransactions = transactions.filter(
    (transaction) => transaction.status !== "cancelled"
  );
  const openingBalance = toNumber(teamSeason.opening_cash_balance);
  const projectedBalance = activeTransactions.reduce(
    (balance, transaction) => balance + transaction.amount,
    openingBalance
  );
  const totalIncome = activeTransactions.reduce(
    (total, transaction) => total + Math.max(0, transaction.amount),
    0
  );
  const totalExpenses = activeTransactions.reduce(
    (total, transaction) => total + Math.abs(Math.min(0, transaction.amount)),
    0
  );
  const currentDayNumber = season.current_day_number ?? 1;
  const rankedTeams = [...(rankingTeamsResult.data ?? [])].sort(
    (left, right) =>
      right.points - left.points
      || left.display_name.localeCompare(right.display_name, "fr")
      || left.id.localeCompare(right.id)
  );
  const teamRankIndex = rankedTeams.findIndex((team) => team.id === teamSeason.id);
  const teamRank = teamRankIndex >= 0 ? teamRankIndex + 1 : null;
  const divisionCode = normalizeTeamDivisionCode(divisionResult.data?.code);
  const divisionName = getTeamDivisionLabel(divisionCode);

  return {
    teamId: teamSeason.team_id,
    teamName: teamSeason.display_name,
    seasonName: season.name,
    currentDayNumber,
    currency: teamSeason.currency,
    balance: toNumber(teamSeason.cash_balance),
    projectedBalance,
    totalIncome,
    totalExpenses,
    canSpend: toNumber(teamSeason.cash_balance) > 0,
    teamPoints: teamSeason.points,
    teamRank,
    divisionCode,
    divisionName,
    chart: buildFinanceProjection({
      currentDayNumber,
      openingBalance,
      entries: transactions.map((transaction) => ({
        dayNumber: transaction.dayNumber,
        amount: transaction.amount,
        status: transaction.status,
      })),
    }),
    transactions,
    alerts: (alertsResult.data ?? []).map((alert) => ({
      id: alert.id,
      checkpointDayNumber: alert.checkpoint_day_number,
      balance: toNumber(alert.balance),
      severity: alert.severity,
      reputationPenalty: alert.reputation_penalty,
      message: alert.message,
    })),
  };
}

function toTransaction(row: TransactionRow): TeamFinanceTransaction {
  return {
    id: row.id,
    dayNumber: row.day_number,
    amount: toNumber(row.amount),
    category: row.category,
    status: row.status,
    description: row.description,
    postedAt: row.posted_at,
  };
}

function toNumber(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
