import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getDashboardSummary: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createAdminClient,
}));

vi.mock("@/services/dashboard-fast-summary", () => ({
  getCurrentDashboardFastSummary: mocks.getDashboardSummary,
}));

import { getFanClubLiveData } from "./fan-club-data";

type QueryFilter = {
  column: string;
  kind: "eq" | "in";
  value: unknown;
};

class FakeAdminClient {
  readonly inFilters: Array<{ column: string; values: unknown[] }> = [];

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rpc(name: string) {
    if (name === "get_active_team_staff_talent_strength") {
      return Promise.resolve({ data: 0, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  resolve(table: string, filters: QueryFilter[]) {
    if (table === "seasons") {
      return [
        {
          id: "00000000-0000-4000-8000-000000000002",
          game_year: 2,
          status: "active",
          current_day_number: 8,
        },
      ];
    }

    if (table === "sporting_directors") {
      return { reputation_points: 10, country_id: null };
    }

    if (table === "team_seasons") {
      const currentSeasonQuery = filters.some(
        (filter) => filter.kind === "eq" && filter.column === "id",
      );
      return currentSeasonQuery
        ? {
            id: "00000000-0000-4000-8000-000000000003",
            team_id: "00000000-0000-4000-8000-000000000004",
            season_id: "00000000-0000-4000-8000-000000000002",
            registration_country_id: null,
          }
        : [];
    }

    if (table === "race_rosters") {
      return [
        {
          id: "00000000-0000-4000-8000-000000000005",
          rider_id: "00000000-0000-4000-8000-000000000006",
          race_registration_id: "00000000-0000-4000-8000-000000000007",
        },
      ];
    }

    if (table === "race_registrations") {
      const currentTeamQuery = filters.some(
        (filter) =>
          filter.kind === "eq" && filter.column === "team_season_id",
      );
      return currentTeamQuery
        ? []
        : [
            {
              id: "00000000-0000-4000-8000-000000000007",
              race_edition_id: "00000000-0000-4000-8000-000000000008",
              team_season_id: null,
            },
          ];
    }

    return [];
  }
}

class FakeQuery {
  private readonly filters: QueryFilter[] = [];

  constructor(
    private readonly admin: FakeAdminClient,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, kind: "eq", value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.admin.inFilters.push({ column, values });
    if (values.some((value) => value === null)) {
      throw new Error(`Filtre UUID invalide pour ${column}`);
    }
    this.filters.push({ column, kind: "in", value: values });
    return this;
  }

  not() {
    return this;
  }

  lte() {
    return this;
  }

  order() {
    return this;
  }

  returns<T>() {
    return this as unknown as PromiseLike<{ data: T; error: null }>;
  }

  maybeSingle<T>() {
    return this as unknown as PromiseLike<{ data: T; error: null }>;
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({
      data: this.admin.resolve(this.table, this.filters),
      error: null,
    }).then(onfulfilled, onrejected);
  }
}

describe("données du Fan Club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboardSummary.mockResolvedValue({
      teamId: "00000000-0000-4000-8000-000000000004",
      teamName: "Équipe actuelle",
      teamSeasonId: "00000000-0000-4000-8000-000000000003",
      seasonId: "00000000-0000-4000-8000-000000000002",
      seasonDayNumber: 8,
    });
  });

  it("ignore l’équipe technique absente d’une inscription historique", async () => {
    const admin = new FakeAdminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            rider_id: "00000000-0000-4000-8000-000000000006",
            first_name: "Alice",
            last_name: "Martin",
            country_id: "00000000-0000-4000-8000-000000000009",
            country_name: "France",
            mountain: 70,
            hills: 70,
            flat: 60,
            time_trial: 60,
            cobbles: 50,
            sprint: 65,
            acceleration: 65,
            downhill: 60,
            endurance: 70,
            resistance: 70,
            recovery: 70,
            breakaway: 60,
            prologue: 60,
          },
        ],
        error: null,
      }),
    };

    const result = await getFanClubLiveData({
      supabase: supabase as never,
      authUserId: "00000000-0000-4000-8000-000000000001",
      headquartersLevel: 1,
    });

    expect(result?.teamName).toBe("Équipe actuelle");
    expect(admin.inFilters.every(({ values }) => !values.includes(null))).toBe(
      true,
    );
  });
});
