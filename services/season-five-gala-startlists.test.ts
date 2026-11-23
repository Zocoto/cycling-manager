import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGalaS5Fixture } from "@/lib/game/__test-fixtures__/season-five-gala";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mocks }));
import { loadSeasonFiveGalaExportSource } from "./season-five-gala-startlists";

type Row = Record<string, unknown>;
let fixture: ReturnType<typeof makeGalaS5Fixture>;
let tables: Record<string, Row[]>;
let ranges: { table: string; from: number; to: number }[];
beforeEach(() => {
  fixture = makeGalaS5Fixture(151);
  ranges = [];
  tables = { seasons: [{ id: "s5", game_year: 5, status: "completed" }, { id: "s6", game_year: 6, status: "active" }],
    season_gala_editions: [fixture.source.edition], season_gala_events: fixture.source.events, season_gala_entries: fixture.source.entries.map(entry => ({ ...entry, edition_id: fixture.source.edition.id })),
    season_gala_entry_riders: fixture.source.selections, season_gala_entry_admissions: fixture.source.admissions };
  mocks.from.mockReset(); mocks.rpc.mockReset();
  mocks.rpc.mockImplementation((_name: string, args: { p_team_ids: string[] }) => ({
    abortSignal: async () => ({ data: fixture.source.identities.filter(identity => args.p_team_ids.includes(identity.team_id)), error: null }),
  }));
  mocks.from.mockImplementation((table: string) => {
    let rows = [...(tables[table] ?? [])];
    let range: [number, number] | null = null;
    const result = () => ({ data: range ? rows.slice(range[0], range[1] + 1) : rows, error: null });
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; },
      order: () => query,
      range: (from: number, to: number) => { range = [from, to]; ranges.push({ table, from, to }); return query; },
      abortSignal: () => query,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
});

describe("S5 package registration source", () => {
  it("reads only fixed S5 records after rollover without PostgREST truncation", async () => {
    const result = await loadSeasonFiveGalaExportSource(undefined, new Date("2026-12-03T17:00:00Z"));
    expect(result.entries).toHaveLength(151);
    expect(result.selections).toHaveLength(1057);
    expect(result.admissions).toHaveLength(1057);
    expect(result.identities).toHaveLength(151);
    expect(ranges.filter(row => row.table === "season_gala_entry_riders").map(row => row.from)).toEqual([0, 1000]);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0][1].p_team_ids).toHaveLength(100);
    expect(mocks.rpc.mock.calls[1][1].p_team_ids).toHaveLength(51);
    expect(mocks.from.mock.calls.some(([table]) => table === "pcm_gala_registrations" || table === "season_gala_registrations")).toBe(false);
  });
  it("refuses export before the closing instant", async () => {
    await expect(loadSeasonFiveGalaExportSource(undefined, new Date("2026-12-03T16:59:59.999Z"))).rejects.toThrow("after registrations close");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a registered club whose S6 identity is not ready", async () => {
    fixture.source.identities[0].identity_ready = false;
    await expect(loadSeasonFiveGalaExportSource(undefined, new Date("2026-12-04"))).rejects.toThrow("S6 identity");
  });
});
