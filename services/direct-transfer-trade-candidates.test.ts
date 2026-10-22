import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/team-roster-capacity", () => ({ loadTeamRosterCapacitySummary: vi.fn(async () => ({ availableGeneralSlots: 0, baseLimit: 35, youthReserveSlots: 0, buildingLevel: 0, specialization: null })) }));

import { getCurrentTeamDirectTransferTradeCandidates, getRiderTransferManagement } from "./transfer-market";

type Row = Record<string, unknown>;
function fixture(ids = ["eligible"], errorTable: string | null = null) {
  const contracts: Row[] = ids.map(id => ({ id: `contract-${id}`, rider_id: id, team_id: "own-team", status: "active", salary_per_season: "5000", transfer_locked_season_id: null }));
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active" }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "own-team", role: "general_manager", status: "active" }],
    seasons: [{ id: "s4", game_year: 4, status: "active" }],
    team_seasons: [{ id: "team-season", team_id: "own-team", season_id: "s4", cash_balance: 0 }],
    rider_contracts: contracts,
    riders: ids.map(id => ({ id, first_name: "Jean", last_name: id, status: "active" })),
    transfer_market_listings: [],
    direct_transfer_offers: [],
  };
  const queries: Array<{ table: string; query: Record<string, ReturnType<typeof vi.fn>> }> = [];
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const result = () => ({ data: rows, error: table === errorTable ? { message: "read failed" } : null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((column: string, value: unknown) => { rows = rows.filter(row => row[column] === value); return query; }),
      in: vi.fn((column: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[column])); return query; }),
      or: vi.fn((filter: string) => {
        const alternatives = [...filter.matchAll(/(\w+)\.in\.\(([^)]+)\)/g)];
        rows = rows.filter(row => alternatives.some(([, column, values]) => values.split(",").includes(String(row[column]))));
        return query;
      }),
      limit: vi.fn((limit: number) => { rows = rows.slice(0, limit); return query; }),
      maybeSingle: vi.fn(async () => ({ ...result(), data: rows[0] ?? null })),
      returns: vi.fn(async () => result()),
    };
    queries.push({ table, query });
    return query;
  });
  const rpc = vi.fn((_name: string, input: { p_rider_ids: string[] }) => ({
    returns: vi.fn(async () => ({ data: input.p_rider_ids.filter(id => id !== "missing-quote").map(id => ({ rider_id: id, salary_per_season: "7000" })), error: null })),
  }));
  mocks.admin.mockReturnValue({ from, rpc });
  return { tables, from, rpc, queries };
}

beforeEach(() => vi.clearAllMocks());

describe("bounded own-team trade candidates", () => {
  it("returns only eligible owned active riders with current salary and a salary estimate", async () => {
    const f = fixture(["eligible", "locked", "historical", "listed", "pending-target", "pending-offered", "future", "retired", "missing-quote", "foreign"]);
    f.tables.rider_contracts.find(row => row.rider_id === "locked")!.transfer_locked_season_id = "s4";
    f.tables.rider_contracts.push({ id: "prior", rider_id: "historical", team_id: "old-team", status: "terminated", transfer_locked_season_id: "s4" });
    f.tables.transfer_market_listings.push({ rider_id: "listed", status: "open" });
    f.tables.direct_transfer_offers.push(
      { rider_id: "pending-target", offered_rider_id: null, status: "pending" },
      { rider_id: "another", offered_rider_id: "pending-offered", status: "pending" },
    );
    f.tables.rider_contracts.push({ rider_id: "future", team_id: "own-team", status: "planned", acquisition_type: "direct" });
    // A same-team renewal is not a conflicting future move.
    f.tables.rider_contracts.push({ rider_id: "eligible", team_id: "own-team", status: "planned", acquisition_type: "renewal" });
    f.tables.riders.find(row => row.id === "retired")!.status = "retired";
    f.tables.rider_contracts.find(row => row.rider_id === "foreign")!.team_id = "foreign-team";

    expect(await getCurrentTeamDirectTransferTradeCandidates("user")).toEqual([
      { id: "eligible", firstName: "Jean", lastName: "eligible", currentSalary: 5000, salaryPerSeason: 7000 },
    ]);
    expect(f.queries.find(query => query.table === "rider_contracts")!.query.eq).toHaveBeenCalledWith("team_id", "own-team");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("calculate_rider_season_salary_quotes", expect.objectContaining({ p_season_id: "s4" }));
  });

  it("keeps the same number of bounded batch queries for 1 or 80 riders, without per-rider calls", async () => {
    const first = fixture();
    await getCurrentTeamDirectTransferTradeCandidates("user");
    const second = fixture(Array.from({ length: 80 }, (_, index) => `rider-${index}`));
    expect(await getCurrentTeamDirectTransferTradeCandidates("user")).toHaveLength(80);
    expect(second.from.mock.calls.length).toBe(first.from.mock.calls.length);
    expect(second.rpc).toHaveBeenCalledOnce();
    expect(second.queries.find(query => query.table === "rider_contracts")!.query.limit).toHaveBeenCalledWith(200);
    expect(second.queries.find(query => query.table === "riders")!.query.limit).toHaveBeenCalledWith(200);
    expect(second.queries.find(query => query.table === "direct_transfer_offers")!.query.limit).toHaveBeenCalledWith(1000);
  });

  it("does no candidate reads without an authenticated director/team context", async () => {
    const f = fixture();
    expect(await getCurrentTeamDirectTransferTradeCandidates("different-user")).toEqual([]);
    expect(f.from).toHaveBeenCalledExactlyOnceWith("sporting_directors");
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("skips all candidate batches for an empty own roster", async () => {
    const f = fixture([]);
    expect(await getCurrentTeamDirectTransferTradeCandidates("user")).toEqual([]);
    expect(f.from).not.toHaveBeenCalledWith("riders");
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("fails closed instead of returning misleading available riders when a batch fails", async () => {
    fixture(["eligible"], "direct_transfer_offers");
    await expect(getCurrentTeamDirectTransferTradeCandidates("user")).rejects.toThrow("offres en attente");
  });

  it("does not load trade candidates on the initial rider sheet or the global market", () => {
    const source = readFileSync(resolve(process.cwd(), "services/transfer-market.ts"), "utf8");
    const initialReadFunctions = source.slice(source.indexOf("export async function getTransferMarketOverview"), source.indexOf("export async function getCurrentTeamDirectTransferTradeCandidates"));
    expect(initialReadFunctions).not.toContain("loadDirectTransferTradeCandidates(");
    expect(initialReadFunctions).not.toContain("getCurrentTeamDirectTransferTradeCandidates(");
  });

  it("allows preparing a trade despite a full roster and zero cash, without eagerly reading trade options", async () => {
    const f = fixture();
    f.tables.riders.push({ id: "rival", first_name: "Marc", last_name: "Rival", status: "active" });
    f.tables.rider_contracts.push({ id: "rival-contract", rider_id: "rival", team_id: "foreign-team", status: "active", start_season_id: "s4", end_season_id: "s4", transfer_locked_season_id: null, salary_per_season: 10000 });
    f.tables.rider_season_ratings = [{ rider_id: "rival", season_id: "s4", age: 25, mountain: 60, hills: 60, flat: 60, time_trial: 60, cobbles: 60, sprint: 60, acceleration: 60, downhill: 60, endurance: 60, resistance: 60, recovery: 60, breakaway: 60, prologue: 60 }];
    const result = await getRiderTransferManagement("user", "rival");
    expect(result).toMatchObject({ canMakeCashOffer: false, canMakeTradeOffer: true, canMakeDirectOffer: true, availableBudget: 0 });
    expect(f.queries.filter(query => query.table === "riders")).toHaveLength(1);
    expect(f.queries.filter(query => query.table === "direct_transfer_offers")).toHaveLength(1);
  });
});
