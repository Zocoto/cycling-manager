import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDashboardOverweightRiders } from "./dashboard-rider-weight";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

function client(results: unknown[]) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    returns: vi.fn().mockImplementation(async () => results.shift()),
  };
  const supabase = { from: vi.fn().mockReturnValue(query) };
  return { supabase, query, input: supabase as unknown as NonNullable<Parameters<typeof getDashboardOverweightRiders>[1]> };
}
const row = {
  rider_id: "climber", mountain: 95, hills: 50, flat: 50, time_trial: 50,
  cobbles: 50, sprint: 50, acceleration: 50, downhill: 50, endurance: 50,
  resistance: 50, recovery: 50, breakaway: 50, prologue: 50,
  riders: { first_name: "Un", last_name: "Grimpeur", height_cm: "170", weight_kg: "61" },
};
const context = { teamId: "team", seasonId: "season" };

describe("dashboard weight reads", () => {
  it("only reads current active teammates and current-season natural ratings, bounded in two queries", async () => {
    const { input, query, supabase } = client([
      { data: [{ rider_id: "climber" }, { rider_id: "sprinter" }], error: null },
      { data: [row, { ...row, rider_id: "sprinter", mountain: 50, sprint: 95 }], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, input)).toEqual([{
      riderId: "climber", name: "Un Grimpeur", profileLabel: "Grimpeur", weightKg: 61, maximumWeightKg: 60.4,
      overweightPhase: "reduced_bonus",
    }]);
    expect(supabase.from.mock.calls).toEqual([["rider_contracts"], ["rider_season_ratings"]]);
    expect(query.eq).toHaveBeenCalledWith("team_id", "team");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.eq).toHaveBeenCalledWith("season_id", "season");
    expect(query.in).toHaveBeenCalledWith("rider_id", ["climber", "sprinter"]);
    expect(query.limit.mock.calls).toEqual([[100], [100]]);
    expect(query.abortSignal).toHaveBeenCalledTimes(2);
    expect(query.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(query.abortSignal.mock.calls[1][0]).toBe(query.abortSignal.mock.calls[0][0]);
  });

  it("skips the second query for an empty team and clears normalized weights", async () => {
    const empty = client([{ data: [], error: null }]);
    expect(await getDashboardOverweightRiders(context, empty.input)).toEqual([]);
    expect(empty.supabase.from).toHaveBeenCalledTimes(1);
    const normalized = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [{ ...row, riders: { ...row.riders, weight_kg: "60.4" } }], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, normalized.input)).toEqual([]);
  });

  it("reports read errors instead of using a stale/incorrect count", async () => {
    const error = client([{ data: null, error: { message: "unavailable" } }]);
    await expect(getDashboardOverweightRiders(context, error.input)).rejects.toThrow("unavailable");
  });

  it("uses the server-only client because authenticated users cannot directly read rider tables", async () => {
    const allowed = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [row], error: null },
    ]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(allowed.input);
    expect(await getDashboardOverweightRiders(context)).toHaveLength(1);
    expect(createSupabaseAdminClient).toHaveBeenCalledOnce();
    expect(allowed.query.eq).toHaveBeenCalledWith("team_id", context.teamId);
    expect(allowed.query.eq).toHaveBeenCalledWith("season_id", context.seasonId);
  });
});
