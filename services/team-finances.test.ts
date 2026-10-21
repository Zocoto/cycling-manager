import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({createAdmin: vi.fn()}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({createSupabaseAdminClient: mocks.createAdmin}));

import {getCurrentTeamFinanceOverview} from "./team-finances";
import type {FinancialDirectorProjectionRow} from "@/lib/game/financial-director-projection";

type Row = Record<string, unknown>;
type Filter = {kind: "eq" | "neq" | "is"; column: string; value: unknown};
type Request = {table: string; select: string; filters: Filter[]; orders: string[]; range: [number, number] | null};
const transaction = (id: string, overrides: Row = {}): Row => ({
  id, team_season_id: "team-season", day_number: 14, amount: "-1000",
  category: "staff_salary", status: "pending", description: "Salaire brut",
  source_reference: `staff-contract:${id}:season:2`, posted_at: null,
  created_at: `2026-10-01T00:00:00.${id.replace(/\D/g, "").padStart(3, "0")}Z`,
  ...overrides,
});
const estimate = (overrides: Partial<FinancialDirectorProjectionRow> = {}): FinancialDirectorProjectionRow => ({
  source_reference: "financial-director:daily:day-14", source_transaction_id: null,
  day_number: 14, amount: "450", effect: "daily_income", base_amount: null,
  bonus_percentage: null, description: "Directeur financier · Revenus quotidiens", ...overrides,
});

class FakeAdmin {
  readonly requests: Request[] = [];
  ledger: Row[] = [];
  repeatBoundary = false;
  errorTable: string | null = null;
  director: Row | null = {id: "director", auth_user_id: "auth-user", status: "active"};
  assignment: Row | null = {sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active"};
  season: Row | null = {id: "season", name: "Saison 4", current_day_number: 13, status: "active"};
  teamSeason: Row | null = {
    id: "team-season", team_id: "team", season_id: "season", display_name: "Kaffa Origins",
    opening_cash_balance: "10000", cash_balance: "900", currency: "EUR", points: 100,
    final_rank: null, division_id: "division", status: "active",
  };

  constructor(readonly events: string[]) {}

  from(table: string) {return new FakeQuery(this, table);}

  resolve(request: Request, single: boolean) {
    this.requests.push(request);
    this.events.push(`read:${request.table}${request.range ? `:${request.range[0]}` : ""}`);
    if (this.errorTable === request.table) return {data: null, error: {message: "Mock unavailable"}};
    let rows: Row[];
    if (request.table === "sporting_directors") rows = this.director ? [this.director] : [];
    else if (request.table === "team_manager_assignments") rows = this.assignment ? [this.assignment] : [];
    else if (request.table === "seasons") rows = this.season ? [this.season] : [];
    else if (request.table === "team_seasons") rows = this.teamSeason ? [this.teamSeason] : [];
    else if (request.table === "team_finance_transactions") rows = this.ledger;
    else if (request.table === "divisions") rows = [{id: "division", code: "continental"}];
    else rows = [];
    rows = rows.filter(row => request.filters.every(({kind, column, value}) => kind === "neq" ? row[column] !== value : (row[column] ?? null) === value));
    if (request.range) {
      const [from, to] = request.range;
      // A concurrent insert before an offset boundary can repeat its last row.
      const offset = this.repeatBoundary && from > 0 ? from - 1 : from;
      rows = rows.slice(offset, offset + to - from + 1);
    }
    return {data: single ? rows[0] ?? null : rows, error: null};
  }
}

class FakeQuery {
  private selected = "";
  private readonly filters: Filter[] = [];
  private readonly orders: string[] = [];
  private bounds: [number, number] | null = null;
  private single = false;
  constructor(private readonly admin: FakeAdmin, private readonly table: string) {}
  select(value: string) {this.selected = value; return this;}
  eq(column: string, value: unknown) {this.filters.push({kind: "eq", column, value}); return this;}
  neq(column: string, value: unknown) {this.filters.push({kind: "neq", column, value}); return this;}
  is(column: string, value: unknown) {this.filters.push({kind: "is", column, value}); return this;}
  order(column: string) {this.orders.push(column); return this;}
  range(from: number, to: number) {this.bounds = [from, to]; return this;}
  returns<T>() {return this as unknown as PromiseLike<{data: T; error: {message: string} | null}>;}
  maybeSingle<T>() {this.single = true; return this as unknown as PromiseLike<{data: T | null; error: {message: string} | null}>;}
  then<T = {data: unknown; error: {message: string} | null}, E = never>(
    fulfilled?: ((value: {data: unknown; error: {message: string} | null}) => T | PromiseLike<T>) | null,
    rejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ): PromiseLike<T | E> {
    return Promise.resolve(this.admin.resolve({table: this.table, select: this.selected, filters: this.filters, orders: this.orders, range: this.bounds}, this.single)).then(fulfilled, rejected);
  }
}

function harness(projections: FinancialDirectorProjectionRow[] = []) {
  const events: string[] = [];
  const admin = new FakeAdmin(events);
  mocks.createAdmin.mockReturnValue(admin);
  const rpc = vi.fn(async (name: string) => {
    events.push(`rpc:${name}`);
    return {data: name === "get_current_team_financial_director_projection" ? projections : null, error: null as {message: string} | null};
  });
  const load = () => getCurrentTeamFinanceOverview({rpc} as never, "auth-user");
  return {admin, events, rpc, load};
}

describe("team finances with read-only financial director forecasts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes Fra's future daily income and savings without reducing gross salary expenses", async () => {
    const projections = Array.from({length: 15}, (_, index) => estimate({day_number: index + 14, source_reference: `financial-director:daily:day-${index + 14}`}));
    for (const [index, day] of [14, 21, 28].entries()) projections.push(estimate({
      day_number: day, source_reference: `financial-director:salary-savings:salary-${index}`,
      source_transaction_id: `salary-${index}`, amount: "12880", effect: "staff_salary",
      base_amount: "322000", bonus_percentage: "4",
    }));
    const {admin, load} = harness(projections);
    admin.ledger = [
      transaction("daily-12", {day_number: 12, amount: "450", category: "other", status: "posted", source_reference: "financial-director:daily:day-12"}),
      transaction("daily-13", {day_number: 13, amount: "450", category: "other", status: "posted", source_reference: "financial-director:daily:day-13"}),
      ...[14, 21, 28].flatMap((day, index) => [transaction(`salary-${index}`, {day_number: day, amount: "-322000"}), transaction(`df-salary-${index}`, {day_number: day, amount: "-6750"})]),
    ];
    const result = await load();
    expect(result?.balance).toBe(900);
    expect(result?.canSpend).toBe(true);
    expect(result?.totalExpenses).toBe(986250);
    expect(result?.totalIncome).toBe(46290);
    expect(result?.projectedBalance).toBe(-929960);
    expect(result?.financialDirectorEffects.filter(effect => effect.status === "pending").reduce((sum, effect) => sum + effect.amount, 0)).toBe(45390);
    expect(result?.transactions.find(row => row.id === "salary-0")?.amount).toBe(-322000);
    expect(result?.chart.at(-1)?.projectedBalance).toBe(result?.projectedBalance);
    expect(result?.chart[12].actualBalance).toBe(10900);
    expect(result?.chart[13].actualBalance).toBeNull();
  });

  it.each([-100, 0, 500])("never turns projected income into spendable cash: cash %s", async balance => {
    const {admin, load} = harness([estimate({amount: "1000000"})]);
    admin.teamSeason!.cash_balance = String(balance);
    const result = await load();
    expect(result?.balance).toBe(balance);
    expect(result?.canSpend).toBe(balance > 0);
    expect(result?.projectedBalance).toBe(1010000);
    expect(result?.chart[12].actualBalance).toBe(10000);
    expect(result?.transactions.every(row => row.status === "pending")).toBe(true);
  });

  it("keeps gross rider/staff charges and adds separate salary-saving income", async () => {
    const {admin, load} = harness([
      estimate({source_reference: "financial-director:salary-savings:staff", source_transaction_id: "staff", effect: "staff_salary", amount: "40", base_amount: "1000", bonus_percentage: "4"}),
      estimate({source_reference: "financial-director:salary-savings:rider", source_transaction_id: "rider", effect: "rider_salary", amount: "80", base_amount: "2000", bonus_percentage: "4"}),
    ]);
    admin.ledger = [transaction("staff"), transaction("rider", {category: "rider_salary", amount: "-2000"})];
    const result = await load();
    expect(result?.totalExpenses).toBe(3000);
    expect(result?.totalIncome).toBe(120);
    expect(result?.projectedBalance).toBe(7120);
    expect(result?.transactions.filter(row => row.amount > 0).map(row => row.category)).toEqual(["other", "other"]);
    expect(result?.chart.at(-1)?.projectedBalance).toBe(7120);
  });

  it.each(["pending", "posted", "cancelled"] as const)("lets a %s real receipt replace its estimate exactly once", async status => {
    const {admin, load} = harness([estimate()]);
    admin.ledger = [transaction("actual-receipt", {amount: "450", category: "other", status, source_reference: "financial-director:daily:day-14"})];
    const result = await load();
    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0].id).toBe("actual-receipt");
    expect(result?.totalIncome).toBe(status === "cancelled" ? 0 : 450);
    expect(result?.financialDirectorEffects).toHaveLength(status === "cancelled" ? 0 : 1);
    expect(result?.projectedBalance).toBe(10000 + (status === "cancelled" ? 0 : 450));
  });

  it("retains the rate actually credited historically rather than today's forecast rate", async () => {
    const {admin, load} = harness([estimate({source_reference: "financial-director:salary-savings:salary", amount: "40", effect: "staff_salary", source_transaction_id: "salary", base_amount: "1000", bonus_percentage: "4"})]);
    admin.ledger = [
      transaction("salary", {day_number: 7, status: "posted"}),
      transaction("old-receipt", {day_number: 7, status: "posted", amount: "110", category: "other", source_reference: "financial-director:salary-savings:salary"}),
    ];
    const result = await load();
    expect(result?.financialDirectorEffects).toEqual([expect.objectContaining({id: "old-receipt", amount: 110, bonusPercentage: 11, status: "posted"})]);
    expect(result?.totalIncome).toBe(110);
    expect(result?.totalExpenses).toBe(1000);
    expect(result?.projectedBalance).toBe(9110);
  });

  it("loads a ledger beyond PostgREST's 1000-row ceiling with deterministic scoped pages", async () => {
    const {admin, load} = harness([estimate()]);
    admin.ledger = Array.from({length: 1001}, (_, index) => transaction(`expense-${index}`, {amount: "-1"}));
    const result = await load();
    expect(result?.transactions).toHaveLength(1002);
    expect(result?.totalExpenses).toBe(1001);
    expect(result?.totalIncome).toBe(450);
    expect(result?.projectedBalance).toBe(9449);
    const requests = admin.requests.filter(request => request.table === "team_finance_transactions");
    expect(requests.map(request => request.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(requests.every(request => request.orders.join() === "day_number,created_at,id")).toBe(true);
    expect(requests.every(request => request.filters.some(filter => filter.column === "team_season_id" && filter.value === "team-season"))).toBe(true);
    expect(result?.chart.at(-1)?.projectedBalance).toBe(result?.projectedBalance);
  });

  it("does not double count a repeated offset boundary when settlement inserts between pages", async () => {
    const {admin, load} = harness([estimate()]);
    admin.ledger = Array.from({length: 1001}, (_, index) => transaction(`expense-${index}`, {amount: "-1"}));
    admin.repeatBoundary = true;
    const result = await load();
    expect(result?.totalExpenses).toBe(1001);
    expect(result?.transactions).toHaveLength(1002);
    expect(new Set(result?.transactions.map(row => row.id)).size).toBe(result?.transactions.length);
    expect(result?.projectedBalance).toBe(9449);
  });

  it("awaits the caller-scoped projection RPC before starting the actual ledger read", async () => {
    const {admin, events, rpc, load} = harness([estimate()]);
    await load();
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["settle_current_team_finances", "get_current_team_financial_director_projection"]);
    expect(rpc.mock.calls.every(call => call.length === 1)).toBe(true);
    expect(events.indexOf("rpc:get_current_team_financial_director_projection")).toBeLessThan(events.indexOf("read:team_finance_transactions:0"));
    expect(admin.requests.find(request => request.table === "sporting_directors")?.filters).toContainEqual({kind: "eq", column: "auth_user_id", value: "auth-user"});
    expect(admin.requests.find(request => request.table === "team_manager_assignments")?.filters).toContainEqual({kind: "eq", column: "role", value: "general_manager"});
  });

  it.each(["director", "assignment", "season", "teamSeason"] as const)("returns no forecast when the active %s cannot be resolved", async resource => {
    const {admin, rpc, load} = harness([estimate()]);
    admin[resource] = null;
    expect(await load()).toBeNull();
    expect(rpc).not.toHaveBeenCalledWith("get_current_team_financial_director_projection");
    expect(admin.requests.some(request => request.table === "team_finance_transactions")).toBe(false);
  });

  it("fails closed when projection loading fails rather than displaying silently incomplete budgets", async () => {
    const {admin, rpc, load} = harness();
    rpc.mockImplementation(async name => ({data: null, error: name === "get_current_team_financial_director_projection" ? {message: "RPC unavailable"} : null}));
    await expect(load()).rejects.toThrow("Impossible de charger la projection du directeur financier : RPC unavailable");
    expect(admin.requests.some(request => request.table === "team_finance_transactions")).toBe(false);
  });

  it("fails closed on an incomplete ledger read", async () => {
    const {admin, load} = harness([estimate()]);
    admin.errorTable = "team_finance_transactions";
    await expect(load()).rejects.toThrow("Impossible de charger le registre financier");
  });

  it("does not start admin reads if the established settlement path fails", async () => {
    const {rpc, load} = harness();
    mocks.createAdmin.mockClear();
    rpc.mockResolvedValue({data: null, error: {message: "Settlement unavailable"}});
    await expect(load()).rejects.toThrow("Impossible de mettre à jour la trésorerie");
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });
});
