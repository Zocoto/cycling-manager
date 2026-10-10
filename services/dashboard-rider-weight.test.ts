import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDashboardOverweightRiders } from "./dashboard-rider-weight";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

function client(results: unknown[]) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
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
  it("bounds weight reads to active teammates and only loads shared programme dates for overweight riders", async () => {
    const { input, query, supabase } = client([
      { data: [{ rider_id: "climber" }, { rider_id: "sprinter" }], error: null },
      { data: [row, { ...row, rider_id: "sprinter", mountain: 50, sprint: 95 }], error: null },
      { data: [], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, input)).toEqual([{
      riderId: "climber", name: "Un Grimpeur", profileLabel: "Grimpeur", weightKg: 61, maximumWeightKg: 60.4,
      overweightPhase: "reduced_bonus",
    }, {
      riderId: "sprinter", name: "Un Grimpeur", profileLabel: "Sprinteur", weightKg: 61,
      maximumWeightKg: 70.8, overweightPhase: "none", isUnderweight: true, minimumWeightKg: 65.1,
    }]);
    expect(supabase.from.mock.calls).toEqual([["rider_contracts"], ["rider_season_ratings"], ["rider_weight_events"]]);
    expect(query.eq).toHaveBeenCalledWith("team_id", "team");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.eq).toHaveBeenCalledWith("season_id", "season");
    expect(query.in).toHaveBeenCalledWith("rider_id", ["climber", "sprinter"]);
    expect(query.in).toHaveBeenCalledWith("rider_id", ["climber"]);
    expect(query.in).toHaveBeenCalledWith("source", ["weight_cut", "weight_gain"]);
    expect(query.eq.mock.calls).toEqual([["team_id", "team"], ["status", "active"], ["season_id", "season"]]);
    expect(query.order).toHaveBeenCalledWith("applied_at", { ascending: false });
    expect(query.limit.mock.calls).toEqual([[100], [100], [1_000]]);
    expect(query.abortSignal).toHaveBeenCalledTimes(3);
    expect(query.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(query.abortSignal.mock.calls[1][0]).toBe(query.abortSignal.mock.calls[0][0]);
    expect(query.abortSignal.mock.calls[2][0]).toBe(query.abortSignal.mock.calls[0][0]);
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
    expect(normalized.supabase.from).toHaveBeenCalledTimes(2);
  });

  it("does not load programme history when only the underweight alert applies", async () => {
    const { input, supabase } = client([
      { data: [{ rider_id: "sprinter" }], error: null },
      { data: [{ ...row, rider_id: "sprinter", mountain: 50, sprint: 95 }], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, input)).toMatchObject([{ riderId: "sprinter", isUnderweight: true }]);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("uses the most recent programme's calendar date even from another team or season", async () => {
    const { input } = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [row], error: null },
      { data: [
        { rider_id: "climber", applied_at: "2026-10-01T01:00:00Z", season_days: { calendar_date: "2026-09-29" } },
        { rider_id: "climber", applied_at: "2026-09-30T01:00:00Z", season_days: { calendar_date: "2026-09-30" } },
      ], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, input)).toMatchObject([{ lastWeightProgramDate: "2026-09-30" }]);
  });

  it("falls back to the Paris calendar date when the programme's season day is missing", async () => {
    const { input } = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [row], error: null },
      { data: [{ rider_id: "climber", applied_at: "2026-10-09T22:30:00Z", season_days: null }], error: null },
    ]);
    expect(await getDashboardOverweightRiders(context, input)).toMatchObject([{ lastWeightProgramDate: "2026-10-10" }]);
  });

  it("does not advertise weight cutting when programme dates cannot be read", async () => {
    const { input } = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [row], error: null },
      { data: null, error: { message: "unavailable" } },
    ]);
    await expect(getDashboardOverweightRiders(context, input)).rejects.toThrow("Lecture des délais d’affûtage");
  });

  it("reports read errors instead of using a stale/incorrect count", async () => {
    const error = client([{ data: null, error: { message: "unavailable" } }]);
    await expect(getDashboardOverweightRiders(context, error.input)).rejects.toThrow("unavailable");
  });

  it("uses the server-only client because authenticated users cannot directly read rider tables", async () => {
    const allowed = client([
      { data: [{ rider_id: "climber" }], error: null },
      { data: [row], error: null },
      { data: [], error: null },
    ]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(allowed.input);
    expect(await getDashboardOverweightRiders(context)).toHaveLength(1);
    expect(createSupabaseAdminClient).toHaveBeenCalledOnce();
    expect(allowed.query.eq).toHaveBeenCalledWith("team_id", context.teamId);
    expect(allowed.query.eq).toHaveBeenCalledWith("season_id", context.seasonId);
  });
});
