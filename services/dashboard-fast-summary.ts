import "server-only";

import type { TeamDivisionCode } from "@/lib/game/economy";
import { normalizeTeamDivisionCode } from "@/lib/game/team-divisions";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type DashboardFastSummaryRow = {
  sporting_director_id: string;
  team_id: string;
  team_season_id: string;
  team_name: string;
  rider_count: number;
  season_id: string;
  season_name: string;
  season_day_number: number;
  cash_balance: number | string;
  currency: string;
  team_points: number;
  team_rank: number | null;
  division_code: string | null;
  inventory_total_units: number;
  inventory_available_units: number;
  race_roster_alert_count: number;
  objective_total_count: number;
  objective_ready_count: number;
  trophy_reward_count: number;
  unread_trophy_count: number;
  daily_reward_available: boolean;
};

export type DashboardFastSummary = {
  sportingDirectorId: string;
  teamId: string;
  teamSeasonId: string;
  teamName: string;
  riderCount: number;
  seasonId: string;
  seasonName: string;
  seasonDayNumber: number;
  balance: number;
  currency: string;
  teamPoints: number;
  teamRank: number | null;
  divisionCode: TeamDivisionCode;
  inventoryTotalUnits: number;
  inventoryAvailableUnits: number;
  raceRosterAlertCount: number;
  objectiveTotalCount: number;
  objectiveReadyCount: number;
  trophyRewardCount: number;
  unreadTrophyCount: number;
  dailyRewardAvailable: boolean;
};

export async function getCurrentDashboardFastSummary(
  supabase: SupabaseServerClient,
): Promise<DashboardFastSummary | null> {
  const result = await supabase
    .rpc("get_current_dashboard_fast_summary_v2")
    .maybeSingle<DashboardFastSummaryRow>();

  if (result.error) {
    throw new Error(
      `Impossible de charger le résumé rapide du bureau : ${result.error.message}`,
    );
  }

  const row = result.data;
  if (!row) return null;

  return {
    sportingDirectorId: row.sporting_director_id,
    teamId: row.team_id,
    teamSeasonId: row.team_season_id,
    teamName: row.team_name,
    riderCount: row.rider_count,
    seasonId: row.season_id,
    seasonName: row.season_name,
    seasonDayNumber: row.season_day_number,
    balance: Number(row.cash_balance),
    currency: row.currency,
    teamPoints: row.team_points,
    teamRank: row.team_rank,
    divisionCode: normalizeTeamDivisionCode(row.division_code),
    inventoryTotalUnits: row.inventory_total_units,
    inventoryAvailableUnits: row.inventory_available_units,
    raceRosterAlertCount: row.race_roster_alert_count,
    objectiveTotalCount: row.objective_total_count,
    objectiveReadyCount: row.objective_ready_count,
    trophyRewardCount: row.trophy_reward_count,
    unreadTrophyCount: row.unread_trophy_count,
    dailyRewardAvailable: row.daily_reward_available,
  };
}
