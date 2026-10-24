import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("next/cache", () => ({ unstable_cache: (load: unknown) => load }));
import { getJuniorRankings } from "./junior-rankings";

type Row = Record<string, unknown>;
type Request = {
  table: string;
  columns: string;
  head: boolean;
  filters: Array<[string, string, unknown]>;
  range: [number, number] | null;
};

function team(index: number, virtual = false): Row {
  return {
    id: `entry-${virtual ? "ai" : "player"}-${index}`,
    season_id: "s4", entity_type: "team",
    entity_key: virtual ? `virtual-team:AI ${index}` : `development-${index}`,
    development_team_id: virtual ? null : `development-${index}`,
    academy_rider_id: null, display_name: virtual ? `AI ${index}` : `Player ${index}`,
    secondary_name: null, country_code: null,
    points: 1000 - index, wins: 2, podiums: 3, race_count: 5,
  };
}

function fixture(rows: Row[], options: { season?: Row | null; fail?: "count" | "rows" | "season" | "riders" } = {}) {
  const season = options.season === undefined ? { id: "s4", name: "Saison 4", game_year: 4, status: "active" } : options.season;
  const requests: Request[] = [];
  const from = vi.fn((table: string) => {
    let filtered = table === "seasons" ? (season ? [season] : []) : [...rows];
    const request: Request = { table, columns: "", head: false, filters: [], range: null };
    const orders: Array<{ key: string; ascending: boolean }> = [];
    requests.push(request);
    const result = () => {
      const isRiderCount = request.columns === "entity_key, academy_rider_id, development_team_id";
      const fail = table === "seasons" ? options.fail === "season" : options.fail === (request.head ? "count" : isRiderCount ? "riders" : "rows");
      const sorted = [...filtered].sort((a, b) => {
        for (const { key, ascending } of orders) {
          const av = a[key], bv = b[key];
          const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          if (comparison) return ascending ? comparison : -comparison;
        }
        return 0;
      });
      return {
        error: fail ? { message: "Lecture indisponible" } : null,
        count: filtered.length,
        data: request.head ? null : sorted.slice(request.range?.[0] ?? 0, Math.min((request.range?.[0] ?? 0) + 1000, request.range ? request.range[1] + 1 : sorted.length)),
      };
    };
    const query = {
      select: (columns: string, config?: { head?: boolean }) => { request.columns = columns; request.head = !!config?.head; return query; },
      eq: (key: string, value: unknown) => {
        request.filters.push([key, "eq", value]);
        filtered = filtered.filter(row => row[key] === value);
        return query;
      },
      not: (key: string, operator: string, value: unknown) => {
        expect(operator).toBe("is"); expect(value).toBeNull();
        request.filters.push([key, "not.is", value]);
        filtered = filtered.filter(row => row[key] != null);
        return query;
      },
      in: (key: string, values: unknown[]) => {
        request.filters.push([key, "in", values]);
        filtered = filtered.filter(row => values.includes(row[key]));
        return query;
      },
      order: (key: string, config: { ascending: boolean }) => { orders.push({ key, ascending: config.ascending }); return query; },
      range: (start: number, end: number) => { request.range = [start, end]; return query; },
      abortSignal: () => query,
      maybeSingle: async () => ({ ...result(), data: filtered[0] ?? null }),
      returns: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  mocks.createAdmin.mockReturnValue({ from });
  return requests;
}

beforeEach(() => vi.clearAllMocks());

describe("classement junior des équipes de joueurs", () => {
  it("retire les équipes virtuelles avant le décompte et recalcule les places sans toucher aux points", async () => {
    const requests = fixture([team(0, true), team(1), team(2, true), team(3)]);
    const ranking = await getJuniorRankings("equipes");
    expect(ranking).toMatchObject({ totalEntries: 2, page: 1, pageCount: 1, pageSize: 50 });
    expect(ranking?.entries.map(({ rank, developmentTeamId, points }) => ({ rank, developmentTeamId, points }))).toEqual([
      { rank: 1, developmentTeamId: "development-1", points: 999 },
      { rank: 2, developmentTeamId: "development-3", points: 997 },
    ]);
    for (const request of requests.filter(r => r.filters.some(([key, , value]) => key === "entity_type" && value === "team"))) {
      expect(request.filters).toContainEqual(["development_team_id", "not.is", null]);
    }
    expect(requests).toHaveLength(4); // One grouped identity lookup, not one query per team.
  });

  it("remplit les pages avec les seules équipes éligibles même si beaucoup d’IA les précèdent", async () => {
    const requests = fixture([
      ...Array.from({ length: 60 }, (_, index) => team(index, true)),
      ...Array.from({ length: 51 }, (_, index) => team(index + 100)),
      { ...team(0), id: "old", season_id: "s3", points: 9999 },
    ]);
    const ranking = await getJuniorRankings("equipes", 2);
    expect(ranking).toMatchObject({ totalEntries: 51, pageCount: 2, page: 2 });
    expect(ranking?.entries).toHaveLength(1);
    expect(ranking?.entries[0]).toMatchObject({ rank: 51, developmentTeamId: "development-150", points: 850 });
    expect(requests.find(r => !r.head && r.filters.some(([key, , value]) => key === "entity_type" && value === "team"))?.range).toEqual([50, 99]);
  });

  it("ne conserve pas une dernière page vide après exclusion des IA", async () => {
    fixture([...Array.from({ length: 50 }, (_, index) => team(index)), team(51, true)]);
    const ranking = await getJuniorRankings("equipes", 2);
    expect(ranking).toMatchObject({ totalEntries: 50, pageCount: 1, page: 1 });
    expect(ranking?.entries).toHaveLength(50);
  });

  it("conserve les écoles de joueurs selon leur identifiant et non leur nom", async () => {
    fixture([{ ...team(0), display_name: "Virtual Stars Academy" }]);
    expect((await getJuniorRankings("equipes"))?.entries[0].displayName).toBe("Virtual Stars Academy");
  });

  it("retourne un classement vide cohérent s’il n’y a que des équipes virtuelles", async () => {
    const requests = fixture([team(0, true), team(1, true)]);
    expect(await getJuniorRankings("equipes", 4)).toMatchObject({ entries: [], totalEntries: 0, page: 1, pageCount: 1 });
    expect(requests).toHaveLength(3);
  });

  it.each(["individuel", "nations"] as const)("ne change pas la vue %s ni ses critères", async view => {
    const entityType = view === "nations" ? "nation" : "individual";
    const requests = fixture([{ ...team(0, true), entity_type: entityType, country_code: "FR" }, team(1)]);
    const ranking = await getJuniorRankings(view);
    expect(ranking).toMatchObject({ totalEntries: 1, view });
    expect(ranking?.entries[0]).toMatchObject({ points: 1000, countryCode: "FR", rankedRiderCount: null });
    expect(requests).toHaveLength(3);
    expect(requests.every(request => !request.filters.some(([, operator]) => operator === "not.is"))).toBe(true);
  });

  it("conserve les règles de départage existantes", async () => {
    fixture([
      { ...team(0), display_name: "Zebra", points: 100, wins: 1 },
      { ...team(1), display_name: "Alpha", points: 100, wins: 1 },
      { ...team(2), display_name: "Winner", points: 100, wins: 2 },
      { ...team(3, true), points: 200 },
    ]);
    expect((await getJuniorRankings("equipes"))?.entries.map(entry => entry.displayName)).toEqual(["Winner", "Alpha", "Zebra"]);
  });

  it.each(["count", "rows", "season", "riders"] as const)("ne publie pas de faux classement si la lecture %s échoue", async fail => {
    fixture([team(0)], { fail });
    await expect(getJuniorRankings("equipes")).rejects.toThrow("Lecture indisponible");
  });

  it("affiche dix juniors distincts et non leurs 78 participations cumulées", async () => {
    const requests = fixture([
      { ...team(0), race_count: 78 },
      ...Array.from({ length: 10 }, (_, index) => ({
        ...team(0), id: `rider-entry-${index}`, entity_type: "individual",
        entity_key: `academy:${index}`, academy_rider_id: `academy-${index}`,
        race_count: index < 8 ? 8 : 7, points: index === 9 ? 0 : 10,
      })),
      { ...team(0), entity_type: "individual", entity_key: "old-season", season_id: "s3" },
      { ...team(1), entity_type: "individual", entity_key: "other-team" },
      { ...team(0, true), entity_type: "individual", entity_key: "virtual-rider" },
    ]);
    expect((await getJuniorRankings("equipes"))?.entries[0]).toMatchObject({ rankedRiderCount: 10, raceCount: 78 });
    expect(requests.at(-1)?.filters).toContainEqual(["development_team_id", "in", ["development-0"]]);
    expect(requests.every(request => ["seasons", "development_ranking_entries"].includes(request.table))).toBe(true);
  });

  it("ne compte qu’une fois un même junior, même avec plusieurs identités de résultat", async () => {
    fixture([
      team(0),
      ...["academy:a", "youth:a"].map(entity_key => ({ ...team(0), entity_type: "individual", entity_key, academy_rider_id: "a" })),
      { ...team(0), entity_type: "individual", entity_key: "archived:b", academy_rider_id: null },
    ]);
    expect((await getJuniorRankings("equipes"))?.entries[0].rankedRiderCount).toBe(2);
  });

  it("ne tronque pas les identités au-delà de mille lignes et ne charge que les équipes de la page", async () => {
    const requests = fixture([
      ...Array.from({ length: 51 }, (_, index) => team(index)),
      ...Array.from({ length: 51 * 21 }, (_, index) => ({
        ...team(Math.floor(index / 21)), entity_type: "individual",
        entity_key: `academy:${String(index).padStart(5, "0")}`, academy_rider_id: `academy-${index}`,
      })),
    ]);
    const ranking = await getJuniorRankings("equipes");
    expect(ranking?.entries).toHaveLength(50);
    expect(ranking?.entries.every(entry => entry.rankedRiderCount === 21)).toBe(true);
    const riderQueries = requests.filter(request => request.columns === "entity_key, academy_rider_id, development_team_id");
    expect(riderQueries.map(request => request.range)).toEqual([[0, 999], [1000, 1999]]);
    for (const query of riderQueries) {
      const ids = query.filters.find(([, operator]) => operator === "in")?.[2] as string[];
      expect(ids).toHaveLength(50);
      expect(ids).not.toContain("development-50");
    }
  });

  it("ne charge pas les classements sans saison active", async () => {
    const requests = fixture([], { season: null });
    expect(await getJuniorRankings("equipes")).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it("ne réactive pas le circuit junior des saisons antérieures à la saison 3", async () => {
    const requests = fixture([team(0)], { season: { id: "s2", name: "Saison 2", game_year: 2, status: "active" } });
    expect(await getJuniorRankings("equipes")).toMatchObject({ enabled: false, entries: [], totalEntries: 0 });
    expect(requests).toHaveLength(1);
  });
});
