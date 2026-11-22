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
    points: 1000 - index, wins: 2, podiums: 3, race_count: 5, ranked_rider_count: 1,
  };
}

function fixture(rows: Row[], options: { season?: Row | null; fail?: "count" | "rows" | "season" } = {}) {
  const season = options.season === undefined ? { id: "s4", name: "Saison 4", game_year: 4, status: "active" } : options.season;
  const requests: Request[] = [];
  const from = vi.fn((table: string) => {
    let filtered = table === "seasons" ? (season ? [season] : []) : [...rows];
    const request: Request = { table, columns: "", head: false, filters: [], range: null };
    const orders: Array<{ key: string; ascending: boolean }> = [];
    requests.push(request);
    const result = () => {
      const fail = table === "seasons" ? options.fail === "season" : options.fail === (request.head ? "count" : "rows");
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
      is: (key: string, value: unknown) => {
        expect(key).toBe("development_team.team.bot"); expect(value).toBeNull();
        request.filters.push([key, "is", value]);
        filtered = filtered.filter(row => !row.managed_bot_id);
        return query;
      },
      order: (key: string, config: { ascending: boolean }) => { orders.push({ key, ascending: config.ascending }); return query; },
      range: (start: number, end: number) => { request.range = [start, end]; return query; },
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
  it("exclut un vrai compte bot même désactivé, ainsi que le remplissage IA, en conservant les humains", async () => {
    const botTeamId = "bae5e30e-cb24-4b15-ba05-22fdc9e7585d";
    const requests = fixture([
      { ...team(0, true), points: 3000 },
      { ...team(1), development_team_id: botTeamId, managed_bot_id: "managed-bot", enabled: false, points: 2000 },
      { ...team(2), display_name: "Human Academy", points: 1000 },
      { ...team(1), entity_type: "individual", development_team_id: botTeamId, academy_rider_id: "bot-rider" },
      { ...team(2), entity_type: "individual", academy_rider_id: "human-rider" },
    ]);
    expect(await getJuniorRankings("equipes")).toMatchObject({
      totalEntries: 1, pageCount: 1,
      entries: [{ rank: 1, displayName: "Human Academy", points: 1000, rankedRiderCount: 1 }],
    });
    const teamQueries = requests.filter(r => r.filters.some(([key, , value]) => key === "entity_type" && value === "team"));
    expect(teamQueries).toHaveLength(2);
    for (const request of teamQueries) {
      expect(request.columns).toContain("development_team:development_teams!inner(team:teams!inner(bot:alpha_bot_managers()))");
      expect(request.filters).toContainEqual(["development_team.team.bot", "is", null]);
      expect(request.filters.some(([key]) => key === "enabled")).toBe(false);
    }
    expect(requests).toHaveLength(3);
    expect(requests.every(request => ["seasons", "development_ranking_entries"].includes(request.table))).toBe(true);
  });

  it("calcule les totaux et pages après exclusion SQL des comptes bots sans limiter leur nombre", async () => {
    const requests = fixture([
      ...Array.from({ length: 20 }, (_, index) => ({ ...team(index), managed_bot_id: `bot-${index}`, points: 2000 + index })),
      ...Array.from({ length: 51 }, (_, index) => team(index + 100)),
      team(99, true),
    ]);
    const ranking = await getJuniorRankings("equipes", 2);
    expect(ranking).toMatchObject({ totalEntries: 51, pageCount: 2, page: 2 });
    expect(ranking?.entries).toHaveLength(1);
    expect(ranking?.entries[0]).toMatchObject({ rank: 51, developmentTeamId: "development-150" });
    expect(requests).toHaveLength(3);
  });

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
    expect(requests).toHaveLength(3);
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

  it.each(["count", "rows", "season"] as const)("ne publie pas de faux classement si la lecture %s échoue", async fail => {
    fixture([team(0)], { fail });
    await expect(getJuniorRankings("equipes")).rejects.toThrow("Lecture indisponible");
  });

  it("affiche dix juniors distincts et non leurs 78 participations cumulées", async () => {
    const requests = fixture([
      { ...team(0), race_count: 78, ranked_rider_count: 10 },
    ]);
    expect((await getJuniorRankings("equipes"))?.entries[0]).toMatchObject({ rankedRiderCount: 10, raceCount: 78 });
    expect(requests).toHaveLength(3);
  });

  it("conserve les juniors comptés pour chaque équipe historique après un transfert", async () => {
    fixture([
      { ...team(0), ranked_rider_count: 2, race_count: 15, points: 120 },
      { ...team(1), ranked_rider_count: 1, race_count: 3, points: 50 },
      // A canonical individual has one display team; it cannot supply the
      // count of riders who earned points for their former team.
      { ...team(1), entity_type: "individual", entity_key: "youth:a", academy_rider_id: "a", points: 170 },
    ]);
    expect((await getJuniorRankings("equipes"))?.entries.map(entry => ({
      team: entry.developmentTeamId, count: entry.rankedRiderCount, points: entry.points,
    }))).toEqual([
      { team: "development-0", count: 2, points: 120 },
      { team: "development-1", count: 1, points: 50 },
    ]);
  });

  it("conserve les grands effectifs pré-agrégés sans recharger les identités individuelles", async () => {
    const requests = fixture([{ ...team(0), ranked_rider_count: 1021 }]);
    expect((await getJuniorRankings("equipes"))?.entries[0].rankedRiderCount).toBe(1021);
    expect(requests).toHaveLength(3);
    expect(requests.filter(request => request.table === "development_ranking_entries").every(request =>
      request.filters.some(([key, , value]) => key === "entity_type" && value === "team"),
    )).toBe(true);
  });

  it("préserve la ligne canonique, son profil et les homonymes distincts", async () => {
    fixture([
      { ...team(0), entity_type: "individual", entity_key: "youth:adarsh-a", academy_rider_id: "adarsh-a", display_name: "Adarsh Shah", points: 275, wins: 3, podiums: 5, race_count: 9 },
      { ...team(1), entity_type: "individual", entity_key: "youth:adarsh-b", academy_rider_id: "adarsh-b", display_name: "Adarsh Shah", points: 80, wins: 1, podiums: 2, race_count: 4 },
    ]);
    const ranking = await getJuniorRankings("individuel");
    expect(ranking).toMatchObject({ totalEntries: 2, page: 1, pageCount: 1 });
    expect(ranking?.entries).toMatchObject([
      { rank: 1, entityKey: "youth:adarsh-a", academyRiderId: "adarsh-a", displayName: "Adarsh Shah", points: 275, wins: 3, podiums: 5, raceCount: 9, rankedRiderCount: null },
      { rank: 2, entityKey: "youth:adarsh-b", academyRiderId: "adarsh-b", displayName: "Adarsh Shah", points: 80, wins: 1, podiums: 2, raceCount: 4, rankedRiderCount: null },
    ]);
  });

  it("départage les homonymes à égalité de manière stable entre deux pages", async () => {
    fixture(Array.from({ length: 51 }, (_, index) => ({
      ...team(index), entity_type: "individual", display_name: "Même Nom", points: 100, wins: 1,
      entity_key: `youth:${String(50 - index).padStart(2, "0")}`, academy_rider_id: `rider-${50 - index}`,
    })));
    const first = await getJuniorRankings("individuel", 1);
    const second = await getJuniorRankings("individuel", 2);
    expect(first).toMatchObject({ totalEntries: 51, pageCount: 2, page: 1 });
    expect(second).toMatchObject({ totalEntries: 51, pageCount: 2, page: 2 });
    expect(first?.entries).toHaveLength(50);
    expect(first?.entries[0]).toMatchObject({ rank: 1, entityKey: "youth:00" });
    expect(first?.entries.at(-1)).toMatchObject({ rank: 50, entityKey: "youth:49" });
    expect(second?.entries).toMatchObject([{ rank: 51, entityKey: "youth:50" }]);
    expect(new Set([...first!.entries, ...second!.entries].map(entry => entry.entityKey)).size).toBe(51);
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
