import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("next/cache", () => ({ unstable_cache: (load: unknown) => load }));
import { getUciRankings } from "./uci-rankings";

type Row = Record<string, unknown>;
function fixture(failSecondSummaryPage = false, repeatPageBoundary = false) {
  const summaries = Array.from({ length: 1232 }, (_, i) => ({
    rider_id: `rider-${String(i).padStart(4, "0")}`, season_id: "s4",
    points: i < 12 ? 1000 - i : i === 1100 ? 840 : 1,
    uci_rank: i < 12 ? i + 1 : i === 1100 ? 13 : i < 1100 ? i + 2 : i + 1,
  }));
  const tables: Record<string, Row[]> = {
    seasons: [{ id: "s4", name: "Saison 4", status: "active" }],
    rider_season_summaries: summaries,
    riders: summaries.map((s, i) => ({ id: s.rider_id, country_id: "ch", first_name: i === 1100 ? "Heinrich" : `Coureur ${i}`, last_name: i === 1100 ? "Schröder" : "Test", avatar_profile_key: "europe_west", avatar_seed: i })),
    rider_season_ratings: summaries.map(s => ({ rider_id: s.rider_id, season_id: "s4", age: 22 })),
    countries: [{ id: "ch", iso_alpha2: "CH", name: "Suisse" }],
  };
  const requests: Array<{ table: string; range: [number, number] | null; ids: unknown[] }> = [];
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const request: typeof requests[number] = { table, range: null, ids: [] };
    requests.push(request);
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter(r => r[key] === value); return query; },
      neq: (key: string, value: unknown) => { rows = rows.filter(r => r[key] !== value); return query; },
      gt: (key: string, value: number) => { rows = rows.filter(r => Number(r[key]) > value); return query; },
      in: (key: string, values: unknown[]) => { request.ids = values; rows = rows.filter(r => values.includes(r[key])); return query; },
      order: (key: string) => { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return query; },
      range: (start: number, end: number) => { request.range = [start, end]; return query; },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      returns: async () => {
        const start = request.range?.[0] ?? 0;
        const data = rows.slice(start, Math.min(start + 1000, (request.range?.[1] ?? 999) + 1));
        if (repeatPageBoundary && table === "rider_season_summaries" && start === 1000) data.unshift(rows[999]);
        return { data, error: failSecondSummaryPage && table === "rider_season_summaries" && start === 1000 ? { message: "Deuxième page indisponible" } : null };
      },
    };
    return query;
  });
  mocks.createAdmin.mockReturnValue({ from, rpc: async () => ({ data: [], error: null }) });
  return { summaries, tables, requests };
}

beforeEach(() => vi.clearAllMocks());

describe("classement UCI complet au-delà de la limite PostgREST", () => {
  it("retrouve un coureur de la deuxième page et l’affiche à son vrai rang", async () => {
    const f = fixture();
    const rankings = await getUciRankings();
    expect(rankings?.riders).toHaveLength(1232);
    expect(rankings?.riders.find(r => r.riderId === "rider-1100")).toMatchObject({ rank: 13, points: 840, riderName: "Heinrich Schröder" });
    expect(f.requests.filter(r => r.table === "rider_season_summaries").map(r => r.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(f.requests.every(r => r.ids.length <= 100)).toBe(true);
    expect(rankings?.nations[0]).toMatchObject({ riderCount: 1232, points: f.summaries.reduce((total, s) => total + s.points, 0) });
  });
  it("départage les ex aequo selon leur rang officiel plutôt que leur prénom", async () => {
    const f = fixture();
    f.summaries[1].points = f.summaries[0].points;
    f.tables.riders[0].first_name = "Zed";
    f.tables.riders[1].first_name = "Aaron";
    expect((await getUciRankings())?.riders.slice(0, 2).map(r => r.riderId)).toEqual(["rider-0000", "rider-0001"]);
  });
  it("ne publie pas un classement partiel lorsque la deuxième page échoue", async () => {
    fixture(true);
    await expect(getUciRankings()).rejects.toThrow("Deuxième page indisponible");
  });
  it("ne double pas un coureur si une arrivée décale la frontière entre deux pages", async () => {
    fixture(false, true);
    const rankings = await getUciRankings();
    expect(rankings?.riders).toHaveLength(1232);
    expect(rankings?.nations[0].riderCount).toBe(1232);
  });
});
