import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), quotes: {} as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));

import { getCurrentTeamHealthOverview } from "./team-health";

describe("medical weight-program preservation preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quotes = { nutritionists: [], protocols: [], weightProgramFormPreservationPercentage: 27.5 };
    mocks.rpc.mockImplementation(async () => ({ data: mocks.quotes, error: null }));
    const rows: Record<string, unknown> = {
      sporting_directors: { id: "director" }, team_manager_assignments: { team_id: "team" },
      seasons: { id: "season", name: "Saison 4", game_year: 4, current_day_number: 22 },
      team_seasons: { id: "team-season", team_id: "team", display_name: "Club", cash_balance: 10_000, currency: "EUR" },
      rider_contracts: [], medical_protocol_catalog: [], staff_contracts: [],
    };
    mocks.from.mockImplementation((table: string) => {
      if (!(table in rows)) throw new Error(`Unexpected medical query: ${table}`);
      const query = {
        select: vi.fn(), eq: vi.fn(),
        maybeSingle: async () => ({ data: rows[table], error: null }),
        returns: async () => ({ data: rows[table], error: null }),
        order: vi.fn(),
      };
      query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
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
