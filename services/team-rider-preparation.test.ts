import { describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamRiderPreparationOverview } from "@/services/team-rider-preparation";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

function createPreparation(overrides: Record<string, unknown> = {}) {
  return {
    id: "prep-active",
    rider_id: "contracted",
    preparation_type: "indoor_track",
    building_level: 3,
    preparation_start_game_day: 101,
    preparation_end_game_day: 102,
    bonus_start_game_day: 103,
    bonus_end_game_day: 106,
    rating_bonus: 2.2,
    status: "planned",
    created_at: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

function mockClient(preparations: ReturnType<typeof createPreparation>[]) {
  const data: Record<string, Record<string, unknown>[]> = {
    sporting_directors: [{ id: "director" }],
    team_manager_assignments: [{ team_id: "team" }],
    seasons: [{ id: "season", name: "Saison 4", game_year: 3, current_day_number: 17 }],
    team_seasons: [{ id: "team-season", display_name: "Équipe Test" }],
    team_infrastructures: [{ infrastructure_code: "indoor_track", level: 3 }, { infrastructure_code: "wind_tunnel", level: 5 }],
    rider_contracts: [{ rider_id: "contracted" }],
    rider_performance_preparations: preparations,
    riders: [{ id: "contracted", first_name: "Coureur", last_name: "Actuel", country_id: "fr" }],
    countries: [{ id: "fr", iso_alpha2: "FR" }],
  };
  const queries = new Map<string, ReturnType<typeof query>>();
  function query(table: string) {
    let rowLimit = Infinity;
    const orders: Array<{ column: string; ascending: boolean }> = [];
    const result = () => {
      const rows = [...(data[table] ?? [])];
      rows.sort((a, b) => {
        for (const order of orders) {
          const comparison = String(a[order.column]).localeCompare(String(b[order.column]));
          if (comparison) return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
      return { data: rows.slice(0, rowLimit), error: null };
    };
    const builder: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      neq: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      returns: ReturnType<typeof vi.fn>;
    } = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        orders.push({ column, ascending: options.ascending });
        return builder;
      }),
      limit: vi.fn((limit: number) => {
        rowLimit = limit;
        return builder;
      }),
      maybeSingle: vi.fn(async () => ({ data: result().data[0] ?? null, error: null })),
      returns: vi.fn(async () => result()),
    };
    return builder;
  }
  const admin = {
    rpc: vi.fn(async () => ({ data: 0, error: null })),
    from: vi.fn((table: string) => {
      const builder = query(table);
      queries.set(table, builder);
      return builder;
    }),
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createSupabaseAdminClient>);
  return { admin, queries };
}

describe("team rider preparation overview", () => {
  it("keeps occupied places before history without more page queries", async () => {
    const history = Array.from({ length: 18 }, (_, index) => createPreparation({
      id: `history-${index}`, status: "completed", created_at: `2026-10-19T10:${String(index).padStart(2, "0")}:00Z`,
    }));
    const { admin, queries } = mockClient([
      createPreparation(),
      createPreparation({ id: "prep-transferred", rider_id: "transferred" }),
      ...history,
    ]);
    const overview = await getCurrentTeamRiderPreparationOverview("auth-user");
    expect(overview?.currentGameDayIndex).toBe(100);
    expect(overview?.facilities.indoor_track).toMatchObject({ capacity: 2, activePreparationIds: ["prep-active", "prep-transferred"] });
    expect(overview?.facilities.wind_tunnel).toMatchObject({ capacity: 3, activePreparationIds: [] });
    expect(overview?.preparations.find((row) => row.id === "prep-transferred")?.riderName).toBe("Coureur indisponible");
    expect(overview?.preparations.find((row) => row.id === "prep-active")?.ratingBonus).toBe(2.2);
    expect(overview?.preparations[0].id).toBe("history-17");
    expect(overview?.riders.map((row) => row.id)).toEqual(["contracted"]);
    const query = queries.get("rider_performance_preparations")!;
    expect(query.eq).toHaveBeenCalledWith("team_id", "team");
    expect(query.order.mock.calls).toEqual([["status", { ascending: false }], ["created_at", { ascending: false }]]);
    expect(query.limit).toHaveBeenCalledWith(40);
    expect(queries.get("riders")?.in).toHaveBeenCalledWith("id", ["contracted", "transferred"]);
    expect(admin.from).toHaveBeenCalledTimes(9);
    expect(admin.rpc.mock.calls).toEqual([["settle_due_rider_performance_preparations"]]);
  });

  it("ignores stale planned occupation after the two preparation days", async () => {
    mockClient([
      createPreparation({ id: "stale", preparation_start_game_day: 98, preparation_end_game_day: 99, bonus_start_game_day: 100, bonus_end_game_day: 103 }),
      createPreparation({ id: "today", preparation_start_game_day: 99, preparation_end_game_day: 100, bonus_start_game_day: 101, bonus_end_game_day: 104 }),
    ]);
    const overview = await getCurrentTeamRiderPreparationOverview("auth-user");
    expect(overview?.facilities.indoor_track.activePreparationIds).toEqual(["today"]);
    expect(overview?.facilities.indoor_track.activePreparationId).toBe("today");
    expect(overview?.preparations).toHaveLength(2);
  });
});
