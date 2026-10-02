import { describe, expect, it, vi } from "vitest";
import { getCurrentDashboardFastSummary, getCurrentDashboardObjectiveSummary } from "./dashboard-fast-summary";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

function client(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data, error }) }));
  return { rpc, supabase: { rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>> };
}
const row = { sporting_director_id: "ds", team_id: "team", team_season_id: "team-season", team_name: "Team",
  rider_count: 20, season_id: "season", season_name: "S3", season_day_number: 22, cash_balance: "123456.70", currency: "EUR",
  team_points: 400, team_rank: 12, division_code: "elite", inventory_total_units: 10, inventory_available_units: 7,
  race_roster_alert_count: 2, objective_total_count: 50, objective_ready_count: 3, trophy_reward_count: 4, unread_trophy_count: 5, daily_reward_available: true };

describe("dashboard business data and deferred objective counts", () => {
  it("preserves the original RPC by default for non-dashboard consumers", async () => {
    const mock = client(row);
    const summary = await getCurrentDashboardFastSummary(mock.supabase);
    expect(mock.rpc).toHaveBeenCalledWith("get_current_dashboard_fast_summary_v2");
    expect(summary).toMatchObject({ balance: 123456.7, riderCount: 20, inventoryAvailableUnits: 7, objectiveReadyCount: 3,
      trophyRewardCount: 4, unreadTrophyCount: 5, dailyRewardAvailable: true });
  });
  it("defers only objectives and preserves every other field", async () => {
    const oldClient = client(row);
    const coreClient = client({ ...row, objective_total_count: 0, objective_ready_count: 0 });
    const original = await getCurrentDashboardFastSummary(oldClient.supabase);
    const core = await getCurrentDashboardFastSummary(coreClient.supabase, { deferObjectives: true });
    expect(coreClient.rpc).toHaveBeenCalledWith("get_current_dashboard_core_summary_v2");
    expect(core).toEqual({ ...original, objectiveTotalCount: 0, objectiveReadyCount: 0 });
    const objectives = client({ total_count: 50, ready_count: 3 });
    expect(await getCurrentDashboardObjectiveSummary(objectives.supabase)).toEqual({ totalCount: 50, readyCount: 3 });
  });
  it("keeps unavailable contexts and RPC failures explicit", async () => {
    expect(await getCurrentDashboardFastSummary(client(null).supabase)).toBeNull();
    expect(await getCurrentDashboardObjectiveSummary(client(null).supabase)).toEqual({ totalCount: 0, readyCount: 0 });
    await expect(getCurrentDashboardFastSummary(client(null, { message: "db down" }).supabase)).rejects.toThrow("db down");
    await expect(getCurrentDashboardObjectiveSummary(client(null, { message: "db down" }).supabase)).rejects.toThrow("db down");
  });
});
