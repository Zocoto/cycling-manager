import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import { getDashboardSecondarySponsorOpportunity } from "./dashboard-secondary-sponsor";

type Row = Record<string, unknown>;
const summary = { sportingDirectorId: "director", teamId: "team", seasonId: "s5", seasonDayNumber: 21 };

function fixture() {
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", status: "active", reputation_points: 1_500 }],
    seasons: [
      { id: "s5", name: "Saison 5", game_year: 5, status: "active", current_day_number: 21 },
      { id: "s6", name: "Saison 6", game_year: 6, status: "planned", current_day_number: 0 },
      { id: "s7", name: "Saison 7", game_year: 7, status: "planned", current_day_number: 0 },
    ],
    secondary_sponsor_contracts: [],
  };
  const state = { failedTable: "" };
  const requests: Array<{ table: string; limit?: number; signals: AbortSignal[] }> = [];
  const from = vi.fn((table: string) => {
    const request = { table, limit: undefined as number | undefined, signals: [] as AbortSignal[] };
    requests.push(request);
    const filters: Array<(row: Row) => boolean> = [];
    let order = "";
    const execute = (single: boolean) => {
      if (state.failedTable === table) return Promise.resolve({ data: null, error: { code: "57014", message: "Timed out" } });
      let rows = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
      if (order) rows = [...rows].sort((first, second) => Number(first[order]) - Number(second[order]));
      if (request.limit !== undefined) rows = rows.slice(0, request.limit);
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null });
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      gte: (key: string, value: number) => { filters.push(row => Number(row[key]) >= value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      order: (key: string) => { order = key; return query; },
      limit: (value: number) => { request.limit = value; return query; },
      abortSignal: (signal: AbortSignal) => { request.signals.push(signal); return query; },
      maybeSingle: () => execute(true),
      returns: () => execute(false),
    };
    return query;
  });
  mocks.createAdmin.mockReturnValue({ from });
  return { tables, state, requests, from };
}

beforeEach(() => vi.clearAllMocks());

describe("secondary sponsor dashboard opportunity", () => {
  it("reads at most three bounded records for an eligible director without generating offers", async () => {
    const f = fixture();
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toEqual({ targetSeasonName: "Saison 6" });
    expect(f.requests.map(request => request.table)).toEqual(["sporting_directors", "seasons", "secondary_sponsor_contracts"]);
    expect(f.requests.map(request => request.limit)).toEqual([1, 2, 1]);
    expect(f.requests.every(request => request.signals.length === 1)).toBe(true);
  });

  it("performs no lookup before the negotiation window", async () => {
    const f = fixture();
    expect(await getDashboardSecondarySponsorOpportunity({ ...summary, seasonDayNumber: 20 })).toBeNull();
    expect(f.from).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("stops after the reputation lookup for an ineligible director", async () => {
    const f = fixture();
    f.tables.sporting_directors[0].reputation_points = 1499.99;
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toBeNull();
    expect(f.requests).toHaveLength(1);
  });

  it.each(["planned", "active", "completed", "terminated"])("hides the alert after an existing %s contract", async status => {
    const f = fixture();
    f.tables.secondary_sponsor_contracts.push({ id: "contract", team_id: "team", season_id: "s6", status });
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toBeNull();
  });

  it("ignores contracts for another team or season and reflects a new signature on the next read", async () => {
    const f = fixture();
    f.tables.secondary_sponsor_contracts.push({ id: "other-team", team_id: "former-team", season_id: "s6", status: "planned" },
      { id: "past", team_id: "team", season_id: "s5", status: "active" });
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toEqual({ targetSeasonName: "Saison 6" });
    f.tables.secondary_sponsor_contracts.push({ id: "new", team_id: "team", season_id: "s6", status: "planned" });
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toBeNull();
  });

  it.each(["missing", "not-planned", "not-next", "before-s4", "before-j21"])("does not advertise an unavailable target (%s)", async reason => {
    const f = fixture();
    if (reason === "missing") f.tables.seasons = f.tables.seasons.slice(0, 1);
    if (reason === "not-planned") f.tables.seasons[1].status = "completed";
    if (reason === "not-next") f.tables.seasons[1].game_year = 8;
    if (reason === "before-s4") { f.tables.seasons[0].game_year = 2; f.tables.seasons[1].game_year = 3; }
    if (reason === "before-j21") f.tables.seasons[0].current_day_number = 20;
    expect(await getDashboardSecondarySponsorOpportunity(summary)).toBeNull();
    expect(f.requests.some(request => request.table === "secondary_sponsor_contracts")).toBe(false);
  });

  it("fails quietly on a bounded read error and skips already-aborted work", async () => {
    const f = fixture();
    f.state.failedTable = "seasons";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await getDashboardSecondarySponsorOpportunity(summary)).toBeNull();
      expect(warning).toHaveBeenCalledWith("dashboard_secondary_sponsor_unavailable", { code: "57014" });
      const aborted = AbortSignal.abort();
      const before = f.requests.length;
      expect(await getDashboardSecondarySponsorOpportunity(summary, aborted)).toBeNull();
      expect(f.requests).toHaveLength(before);
    } finally { warning.mockRestore(); }
  });
});
