import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTeamContractManagementOverview } from "@/services/team-contract-management";
import { getRiderTransferManagement } from "@/services/transfer-market";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  loadCapacity: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/services/team-roster-capacity", () => ({ loadTeamRosterCapacitySummary: mocks.loadCapacity }));

type Row = Record<string, unknown>;

function fixture({
  homegrown = false,
  successorSalary = 0,
  homegrownBase = null,
  rosterBase = null,
  retention = false,
}: {
  homegrown?: boolean;
  successorSalary?: number | string;
  homegrownBase?: number | string | null;
  rosterBase?: number | string | null;
  retention?: boolean;
} = {}) {
  const active = {
    id: "current", rider_id: "rider", team_id: "team", start_season_id: "s4", end_season_id: "s4",
    salary_per_season: 0, currency_code: "EUR", status: "active", acquisition_type: "academy",
  };
  const successor = {
    id: "future", rider_id: "rider", team_id: "team", start_season_id: "s5", end_season_id: "s5",
    salary_per_season: successorSalary, currency_code: "EUR", status: "planned", acquisition_type: "renewal",
    homegrown_salary_before_discount: homegrownBase, roster_management_salary_before_discount: rosterBase,
  };
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active" }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active" }],
    seasons: [
      { id: "s4", name: "Saison 4", game_year: 4, status: "active" },
      { id: "s5", name: "Saison 5", game_year: 5, status: "planned" },
      { id: "s6", name: "Saison 6", game_year: 6, status: "planned" },
    ],
    team_seasons: [{ id: "team-s4", team_id: "team", season_id: "s4", currency: "EUR", cash_balance: 100_000 }],
    rider_contracts: [active, successor],
    riders: [{ id: "rider", country_id: "fr", first_name: "Jeune", last_name: "Promu", status: "active", avatar_profile_key: null, avatar_seed: null, potential_steps: 5 }],
    rider_season_ratings: [{
      rider_id: "rider", season_id: "s4", age: 18,
      mountain: 45, hills: 45, flat: 45, time_trial: 45, cobbles: 45, sprint: 45, acceleration: 45,
      downhill: 45, endurance: 45, resistance: 45, recovery: 45, breakaway: 45, prologue: 45,
    }],
    countries: [{ id: "fr", name: "France", iso_alpha2: "FR" }],
    rider_special_abilities: homegrown ? [{ rider_id: "rider", ability_code: "homegrown" }] : [],
    youth_academy_riders: homegrown ? [{ team_id: "team", status: "promoted", promoted_rider_id: "rider" }] : [],
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn((column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return query;
      }),
      lte: vi.fn((column: string, value: number) => {
        rows = rows.filter((row) => Number(row[column]) <= value);
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        rows = column === "rider_condition_states.rider_id"
          ? rows.map((row) => ({
              ...row,
              rider_condition_states: (row.rider_condition_states as Row[])
                .filter((condition) => values.includes(condition.rider_id)),
            }))
          : rows.filter((row) => values.includes(row[column]));
        return query;
      }),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      returns: vi.fn(async () => ({ data: rows, error: null })),
    };
    return query;
  });
  const rpc = vi.fn((name: string) => name === "calculate_rider_season_salary_quotes" ? ({
    returns: vi.fn(async () => ({ data: [{ rider_id: "rider", salary_per_season: 6_000 }], error: null })),
  }) : Promise.resolve({ data: 0, error: null }));
  mocks.createAdmin.mockReturnValue({ from, rpc });
  mocks.loadCapacity.mockResolvedValue({ buildingLevel: retention ? 5 : 0, specialization: retention ? "retention_cell" : null });
  return { active, successor, from, rpc, tables };
}

beforeEach(() => vi.clearAllMocks());

it.each([["39.99", true], ["40", false]] as const)(
  "uses the latest eligible day for contract renewals at morale %s",
  async (morale, blocked) => {
    const { active, tables } = fixture();
    tables.rider_contracts = [active];
    tables.seasons[0].current_day_number = 5;
    tables.season_days = [
      { season_id: "s4", day_number: 4, rider_condition_states: [{ rider_id: "rider", morale }] },
      { season_id: "s4", day_number: 2, rider_condition_states: [{ rider_id: "rider", morale: 60 }] },
      { season_id: "s4", day_number: 5, rider_condition_states: [{ rider_id: "other", morale: 60 }] },
      { season_id: "s4", day_number: 6, rider_condition_states: [{ rider_id: "rider", morale: 60 }] },
      { season_id: "s5", day_number: 5, rider_condition_states: [{ rider_id: "rider", morale: 20 }] },
    ];

    const overview = await getTeamContractManagementOverview("user");
    expect(overview?.riders[0].renewalBlockedByMorale).toBe(blocked);
    expect(overview?.riders[0].renewalOffers).toHaveLength(blocked ? 0 : 2);
    expect(overview?.eligibleCount).toBe(blocked ? 0 : 1);
    expect(overview?.estimatedRenewalPayroll).toBe(blocked ? 0 : 6_000);
  },
);

describe("contract-management upgrade salary", () => {
  it("shows an accepted future departure as leaving and removes renewal choices", async () => {
    const f = fixture({ successorSalary: 9000 });
    f.successor.team_id = "buyer-team";
    f.successor.acquisition_type = "direct_transfer";
    const overview = await getTeamContractManagementOverview("user");
    expect(overview?.riders[0]).toMatchObject({ status: "leaving", renewalOffers: [] });
    expect(overview?.leavingCount).toBe(1);
    expect((await getRiderTransferManagement("user", "rider"))?.renewalOptions).toEqual([]);
    expect(f.active.status).toBe("active");
  });
  it("includes the current age, talent and all native ratings without additional reads", async () => {
    const f = fixture();
    Object.assign(f.tables.rider_season_ratings[0], {
      mountain: 61, hills: 62, flat: 63, time_trial: 79, cobbles: 65,
      sprint: 66, acceleration: 67, downhill: 68, endurance: 69,
      resistance: 70, recovery: 71, breakaway: 72, prologue: 73,
    });
    const overview = await getTeamContractManagementOverview("user");

    expect(overview?.riders[0]).toMatchObject({
      age: 18,
      potentialSteps: 5,
      ratings: {
        mountain: 61, hills: 62, flat: 63, timeTrial: 79, cobbles: 65,
        sprint: 66, acceleration: 67, downhill: 68, endurance: 69,
        resistance: 70, recovery: 71, breakaway: 72, prologue: 73,
      },
      currentSalary: 0,
      nextSalary: 0,
      renewalOffers: [
        { targetEndSeasonYear: 6, startSeasonYear: 5, salaryPerSeason: 7_500, premiumPercent: 25 },
      ],
    });
    expect(f.from.mock.calls.filter(([table]) => table === "riders")).toHaveLength(1);
    expect(f.from.mock.calls.filter(([table]) => table === "rider_season_ratings")).toHaveLength(1);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });

  it("offers a paid two-season upgrade for a junior with a legacy zero renewal", async () => {
    const f = fixture();
    const overview = await getTeamContractManagementOverview("user");
    expect(overview?.riders[0].renewalOffers).toEqual([
      { targetEndSeasonYear: 6, startSeasonYear: 5, salaryPerSeason: 7_500, premiumPercent: 25 },
    ]);
    // This read-only overview must not pretend the old signed contract changed.
    expect(overview?.riders[0].currentSalary).toBe(0);
    expect(overview?.riders[0].nextSalary).toBe(0);
    expect(f.active.salary_per_season).toBe(0);
    expect(f.successor.salary_per_season).toBe(0);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("calculate_rider_season_salary_quotes", {
      p_rider_ids: ["rider"], p_season_id: "s5",
    });
  });

  it("applies homegrown, retention and the young-rider premium exactly once", async () => {
    fixture({ homegrown: true, homegrownBase: "0", rosterBase: "0", successorSalary: "0", retention: true });
    const overview = await getTeamContractManagementOverview("user");
    expect(overview?.riders[0].renewalOffers[0].salaryPerSeason).toBe(3_562.5);
  });

  it("does not reprice an existing positive homegrown basis", async () => {
    fixture({ homegrown: true, homegrownBase: "12000", rosterBase: "6000", successorSalary: "5700", retention: true });
    const overview = await getTeamContractManagementOverview("user");
    expect(overview?.riders[0].renewalOffers[0].salaryPerSeason).toBe(7_125);
    expect(overview?.riders[0].nextSalary).toBe(5_700);
  });

  it("keeps positive retention and ordinary signed salary bases", async () => {
    fixture({ rosterBase: "10000", successorSalary: "9500", retention: true });
    expect((await getTeamContractManagementOverview("user"))?.riders[0].renewalOffers[0].salaryPerSeason).toBe(11_875);
    fixture({ successorSalary: 8_000 });
    expect((await getTeamContractManagementOverview("user"))?.riders[0].renewalOffers[0].salaryPerSeason).toBe(10_000);
  });

  it("ignores a nonpositive retention basis without losing a positive signed salary", async () => {
    fixture({ rosterBase: -100, successorSalary: "8000" });
    expect((await getTeamContractManagementOverview("user"))?.riders[0].renewalOffers[0].salaryPerSeason).toBe(10_000);
  });

  it.each([
    { options: {}, expected: 7_500 },
    { options: { homegrown: true, homegrownBase: "0", rosterBase: "0", successorSalary: "0", retention: true }, expected: 3_562.5 },
    { options: { homegrown: true, homegrownBase: null, rosterBase: "6000", successorSalary: "5700", retention: true }, expected: 3_562.5 },
    { options: { homegrown: true, homegrownBase: "0", rosterBase: "6000", successorSalary: "5700", retention: true }, expected: 3_562.5 },
    { options: { homegrown: true, homegrownBase: "12000", rosterBase: "6000", successorSalary: "5700", retention: true }, expected: 7_125 },
    { options: { rosterBase: "10000", successorSalary: "9500", retention: true }, expected: 11_875 },
    { options: { rosterBase: 0, successorSalary: "8000" }, expected: 10_000 },
  ])("shows the same paid upgrade in rider management and the contracts office (%j)", async ({ options, expected }) => {
    fixture(options);
    const overview = await getTeamContractManagementOverview("user");
    const details = await getRiderTransferManagement("user", "rider");
    expect(details?.renewalOptions[0].salaryPerSeason).toBe(expected);
    expect(details?.renewalOptions).toEqual(overview?.riders[0].renewalOffers);
  });
});
