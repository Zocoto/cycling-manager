import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), quotes: {} as unknown, rows: {} as Record<string, unknown> }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));

import { getCurrentTeamHealthOverview } from "./team-health";

describe("medical weight-program preservation preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quotes = { nutritionists: [], protocols: [], weightProgramFormPreservationPercentage: 27.5 };
    mocks.rpc.mockImplementation(async (rpc: string) => ({ data: rpc === "get_recent_supplement_use_counts" ? [] : mocks.quotes, error: null }));
    const rows: Record<string, unknown> = mocks.rows = {
      sporting_directors: { id: "director" }, team_manager_assignments: { team_id: "team" },
      seasons: { id: "season", name: "Saison 4", game_year: 4, starts_on: "2026-11-09", current_day_number: 22 },
      team_seasons: { id: "team-season", team_id: "team", display_name: "Club", cash_balance: 10_000, currency: "EUR" },
      rider_contracts: [], medical_protocol_catalog: [], staff_contracts: [],
    };
    mocks.from.mockImplementation((table: string) => {
      if (!(table in rows)) throw new Error(`Unexpected medical query: ${table}`);
      const filters: Array<(row: Record<string, string>) => boolean> = [];
      let page = (rows[table] as Record<string, string>[] | undefined) ?? [];
      const query = {
        select() { return query; },
        eq(key: string, value: string) {
          if (table === "halloween_rider_effects") filters.push(row => row[key] === value);
          return query;
        },
        in(key: string, values: string[]) {
          if (table === "halloween_rider_effects") filters.push(row => values.includes(row[key]));
          return query;
        },
        gte(key: string, value: string) {
          if (table === "halloween_rider_effects") {
            expect(value).toBe("2026-11-09 00:00:00 Europe/Paris");
            filters.push(row => row[key] >= "2026-11-08T23:00:00.000Z");
          }
          return query;
        },
        lte() { return query; },
        gt() { return query; },
        limit() { return query; },
        range(from: number, to: number) {
          page = page.filter(row => filters.every(filter => filter(row))).slice(from, to + 1);
          return query;
        },
        maybeSingle: async () => ({ data: rows[table], error: null }),
        returns: async () => ({ data: page, error: null }),
        order() { return query; },
      };
      return query;
    });
  });

  it("uses the server's effective percentage in the existing medical request", async () => {
    expect(await getCurrentTeamHealthOverview("auth-user")).toMatchObject({ weightProgramFormPreservationPercentage: 27.5 });
    expect(mocks.rpc.mock.calls).toEqual([["get_team_medical_staff_effective_quotes", { p_team_id: "team", p_team_season_id: "team-season" }]]);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "sporting_directors", "team_manager_assignments", "seasons", "team_seasons",
      "rider_contracts", "medical_protocol_catalog", "staff_contracts",
    ]);
  });

  it("includes each successful tea dose in the seasonal total only for Nutrition", async () => {
    const riderId = "rider-with-tea";
    const dose = { rider_id: riderId, item_id: "spectres-tea", used_at: "2026-11-08T23:00:00.000Z" };
    Object.assign(mocks.rows, {
      rider_contracts: [{ rider_id: riderId }],
      riders: [{ id: riderId, country_id: "country", first_name: "Test", last_name: "Rider",
        height_cm: 180.2, weight_kg: "76.0", baseline_weight_kg: "78.0", physiology_version: 1 }],
      rider_season_ratings: [],
      season_days: [{ id: "day", day_number: 22, calendar_date: "2026-11-30" }],
      rider_injuries: [], rider_form_camps: [], countries: [],
      rider_condition_states: [], rider_nutrition_interventions: [], rider_morale_events: [],
      rider_weight_events: [
        { rider_id: riderId, season_id: "season", source: "weight_cut", weight_delta_kg: "-0.6",
          applied_at: "2026-11-10T08:00:00Z", game_day_index: 100 },
        { rider_id: riderId, season_id: "past", source: "supplement", weight_delta_kg: "0.8" },
      ],
      halloween_rider_effects: [
        dose, { ...dose, used_at: "2026-11-10T12:00:00Z" },
        { ...dose, used_at: "2026-11-08T22:59:59Z" },
        { ...dose, rider_id: "another-rider" },
        { ...dose, item_id: "giants-syrup" },
      ],
    });

    const effectif = await getCurrentTeamHealthOverview("auth-user");
    expect(effectif?.riders[0]).toMatchObject({ seasonWeightDeltaKg: -0.6, seasonTeaWeightLossKg: 0 });
    expect(mocks.from).not.toHaveBeenCalledWith("halloween_rider_effects");

    const nutrition = await getCurrentTeamHealthOverview("auth-user", { includeConsumableWeight: true });
    expect(nutrition?.riders[0]).toMatchObject({
      weightKg: 76, seasonWeightDeltaKg: -2.6, seasonTeaWeightLossKg: 2,
      weightProgramCooldownDays: 0, nextWeightCutGameDayIndex: 105,
    });
  });

  it.each([
    [null, 0], [{}, 0], [{ weightProgramFormPreservationPercentage: "15" }, 15],
    [{ weightProgramFormPreservationPercentage: -2 }, 0], [{ weightProgramFormPreservationPercentage: 999 }, 35],
    [{ weightProgramFormPreservationPercentage: "invalid" }, 0], [{ weightProgramFormPreservationPercentage: Infinity }, 0],
  ])("defaults or bounds an old/malformed payload (%j)", async (payload, expected) => {
    mocks.quotes = payload;
    expect((await getCurrentTeamHealthOverview("auth-user"))?.weightProgramFormPreservationPercentage).toBe(expected);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
