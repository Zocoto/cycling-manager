import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mock.createAdmin }));

import { getSecondarySponsoringStateForAuthUser } from "./secondary-sponsors";

type Row = Record<string, unknown>;
type Filter = { kind: string; column: string; value: unknown };
type QueryRecord = {
  table: string;
  filters: Filter[];
  orderBy?: { column: string; ascending: boolean };
  range?: [number, number];
  limit?: number;
  inserted?: Row[];
};
type Result = { data: Row[] | Row | null; error: { code?: string; message: string } | null };

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function objective(offerId: string, index: number): Row {
  return {
    id: `${offerId}-objective-${index}`, offer_id: offerId, display_order: index + 1,
    race_edition_id: uuid(5_000 + index),
    race_slug: `existing-${offerId}-${index}`, race_label: `Existing race ${index}`,
    race_category_code: "national", target_rank: 8, cash_reward: 12_345 + index,
    status: "draft", best_rank: null,
  };
}

function fixture(raceCount = 6) {
  const queries: QueryRecord[] = [];
  const inserts: Array<{ table: string; rows: Row[] }> = [];
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active", reputation_points: 2_500 }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active", created_at: "2026-10-01" }],
    teams: [{ id: "team", home_country_id: "be" }],
    seasons: [
      { id: "s4", game_year: 4, name: "Saison 4", status: "active", current_day_number: 21 },
      { id: "s5", game_year: 5, name: "Saison 5", status: "planned", current_day_number: 1 },
    ],
    countries: [{ id: "be", name: "Belgique", iso_alpha2: "BE" }],
    secondary_sponsor_contracts: [],
    secondary_sponsor_offers: ["a", "b", "c"].map((key) => ({
      id: `offer-${key}`, secondary_sponsor_id: `sponsor-${key}`, sporting_director_id: "director",
      team_id: "team", target_season_id: "s5", status: "open",
    })),
    secondary_sponsor_catalog: ["a", "b", "c"].map((key) => ({
      id: `sponsor-${key}`, country_id: "be", name: `Sponsor ${key}`, prestige: 1,
      primary_color: "#174A8B", accent_color: "#7CC6F2", logo_variant: "wordmark",
    })),
    secondary_sponsor_objectives: [],
    race_categories: [{ id: "national", code: "national" }],
    race_editions: Array.from({ length: raceCount }, (_, index) => ({
      id: uuid(10_000 + index), race_id: uuid(index),
      race_category_id: "national", season_id: "s5", display_name: `Race ${index}`,
      registration_policy: "open", minimum_reputation: 0, status: "planned",
    })),
    races: Array.from({ length: raceCount }, (_, index) => ({
      id: uuid(index), country_id: index >= raceCount - 3 ? "be" : "fr",
      slug: `race-${index}`, status: "active",
    })),
  };
  const state = {
    failCalendar: false,
    failRaceId: "",
    activeRaceRequests: 0,
    maxActiveRaceRequests: 0,
  };

  const from = vi.fn((table: string) => {
    const record: QueryRecord = { table, filters: [] };
    queries.push(record);
    const filter = (kind: string, column: string, value: unknown) => {
      record.filters.push({ kind, column, value });
      return query;
    };
    const execute = async (single = false): Promise<Result> => {
      if (record.inserted) {
        inserts.push({ table, rows: structuredClone(record.inserted) });
        tables[table] ??= [];
        tables[table].push(...record.inserted.map((row, index) => ({
          id: `inserted-${inserts.length}-${index}`, status: "draft", best_rank: null, ...row,
        })));
        return { data: null, error: null };
      }
      if (state.failCalendar && ["race_editions", "races", "race_categories"].includes(table)) {
        return { data: null, error: { message: "Calendar unavailable" } };
      }
      const reputationFilter = record.filters.find((entry) => entry.kind === "lte" && entry.column === "minimum_reputation");
      if (table === "race_editions" && reputationFilter && !Number.isInteger(reputationFilter.value)) {
        return { data: null, error: { code: "22P02", message: `invalid input syntax for type integer: "${reputationFilter.value}"` } };
      }
      const idFilter = record.filters.find((entry) => entry.kind === "in" && entry.column === "id");
      if (table === "races" && Array.isArray(idFilter?.value) && idFilter.value.length > 75) {
        return { data: null, error: { message: "URI too long: more than 75 UUIDs" } };
      }
      const isRaceRequest = table === "races";
      if (isRaceRequest) {
        state.activeRaceRequests++;
        state.maxActiveRaceRequests = Math.max(state.maxActiveRaceRequests, state.activeRaceRequests);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      try {
        if (table === "races" && state.failRaceId && Array.isArray(idFilter?.value) && idFilter.value.includes(state.failRaceId)) {
          return { data: null, error: { message: "One relation batch failed" } };
        }
        let rows = [...(tables[table] ?? [])].filter((row) => record.filters.every(({ kind, column, value }) => {
          if (kind === "eq") return row[column] === value;
          if (kind === "neq") return row[column] !== value;
          if (kind === "in") return (value as unknown[]).includes(row[column]);
          if (kind === "lte") return row[column] !== null && row[column] !== undefined && Number(row[column]) <= Number(value);
          if (kind === "not-null") return row[column] !== null && row[column] !== undefined;
          return true;
        }));
        const orderBy = record.orderBy;
        if (orderBy) rows.sort((a, b) => String(a[orderBy.column]).localeCompare(String(b[orderBy.column])) * (orderBy.ascending ? 1 : -1));
        const [start, end] = record.range ?? [0, 999];
        rows = rows.slice(start, Math.min(end + 1, start + 1_000));
        if (record.limit !== undefined) rows = rows.slice(0, record.limit);
        return { data: single ? rows[0] ?? null : rows, error: null };
      } finally {
        if (isRaceRequest) state.activeRaceRequests--;
      }
    };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => filter("eq", column, value),
      neq: (column: string, value: unknown) => filter("neq", column, value),
      in: (column: string, value: unknown[]) => filter("in", column, value),
      lte: (column: string, value: unknown) => filter("lte", column, value),
      not: (column: string, operator: string, value: unknown) => filter(operator === "is" && value === null ? "not-null" : "not", column, value),
      order: (column: string, options?: { ascending?: boolean }) => {
        record.orderBy = { column, ascending: options?.ascending !== false };
        return query;
      },
      range: (start: number, end: number) => { record.range = [start, end]; return query; },
      limit: (value: number) => { record.limit = value; return query; },
      insert: (values: Row | Row[]) => { record.inserted = Array.isArray(values) ? values : [values]; return query; },
      maybeSingle: () => execute(true),
      returns: () => execute(),
      then: (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => execute().then(resolve, reject),
    };
    return query;
  });
  mock.createAdmin.mockReturnValue({ from });
  return { tables, queries, inserts, state, from };
}

beforeEach(() => vi.clearAllMocks());

describe("secondary sponsor calendar resilience", () => {
  it.each(["1569.26", 1569.26, 1569.99, 1500.01, 1570])("accepts reputation %s without rounding up an integer race threshold", async (reputation) => {
    const f = fixture(8);
    f.tables.sporting_directors[0].reputation_points = reputation;
    for (let index = 0; index < 3; index++) f.tables.race_editions[index].minimum_reputation = 1500;
    f.tables.race_editions[3].minimum_reputation = 1570;
    f.tables.race_editions[4].minimum_reputation = 1569;
    f.tables.race_editions[5].minimum_reputation = 1569;
    f.tables.race_editions[6].minimum_reputation = 1569;
    f.tables.race_editions[7].minimum_reputation = 1570;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    const bound = f.queries.find((query) => query.table === "race_editions")?.filters.find((entry) => entry.kind === "lte" && entry.column === "minimum_reputation")?.value;
    expect(bound).toBe(Math.floor(Number(reputation)));
    const requestedRaceIds = f.queries.filter((query) => query.table === "races").flatMap((query) => query.filters.filter((entry) => entry.kind === "in" && entry.column === "id").flatMap((entry) => entry.value as string[]));
    const expected = f.tables.race_editions.filter((edition) => Number(edition.minimum_reputation) <= Number(reputation)).map((edition) => edition.race_id);
    expect([...new Set(requestedRaceIds)].sort()).toEqual(expected.sort());
    expect(f.tables.sporting_directors[0].reputation_points).toBe(reputation);
  });

  it("keeps a reputation below 1500 locked without querying the calendar", async () => {
    const f = fixture();
    f.tables.sporting_directors[0].reputation_points = "1499.99";
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state).toMatchObject({ kind: "reputation-locked", currentReputation: 1499.99 });
    expect(f.queries.some((query) => query.table === "race_editions")).toBe(false);
    expect(f.inserts).toEqual([]);
  });

  it("pages a growing calendar and bounds UUID relation batches and concurrency", async () => {
    const f = fixture(1_203);
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    if (state?.kind !== "offers") throw Error("Expected secondary offers");
    expect(state.offers).toHaveLength(3);
    // The only domestic races are past the first 1,000 rows. They must survive
    // pagination and win the existing domestic-priority selection unchanged.
    for (const offer of state.offers) {
      expect(offer.objectives.map((entry) => entry.raceSlug).sort()).toEqual(["race-1200", "race-1201", "race-1202"]);
      for (const entry of offer.objectives) {
        const edition = f.tables.race_editions.find((candidate) => candidate.display_name === entry.raceLabel);
        expect(edition?.season_id).toBe("s5");
        expect(entry.raceEditionId).toBe(edition?.id);
      }
    }
    const editionReads = f.queries.filter((query) => query.table === "race_editions");
    expect(editionReads.length).toBeGreaterThan(1);
    expect(editionReads.every((query) => query.orderBy?.column === "id" && query.range !== undefined)).toBe(true);
    const raceReads = f.queries.filter((query) => query.table === "races");
    expect(raceReads.length).toBeGreaterThan(1);
    expect(raceReads.every((query) => query.filters.some((entry) => entry.kind === "in" && Array.isArray(entry.value) && entry.value.length <= 75))).toBe(true);
    expect(f.state.maxActiveRaceRequests).toBe(1);
    expect(f.inserts.every((insert) => insert.table === "secondary_sponsor_objectives")).toBe(true);
    expect(f.queries.some((query) => query.table === "team_sponsor_contracts")).toBe(false);
  });

  it("loads existing proposals without a calendar or a signed primary sponsor", async () => {
    const f = fixture();
    const existing = ["offer-a", "offer-b", "offer-c"].flatMap((id) => Array.from({ length: 3 }, (_, index) => objective(id, index)));
    f.tables.secondary_sponsor_objectives = structuredClone(existing);
    f.state.failCalendar = true;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    if (state?.kind !== "offers") throw Error("Expected secondary offers");
    expect(state.offers.flatMap((offer) => offer.objectives.map((entry) => entry.cashReward))).toEqual(existing.map((entry) => entry.cash_reward));
    expect(state.offers.flatMap((offer) => offer.objectives.map((entry) => entry.raceEditionId))).toEqual(existing.map((entry) => entry.race_edition_id));
    expect(f.tables.secondary_sponsor_objectives).toEqual(existing);
    expect(f.queries.some((query) => ["race_editions", "races", "race_categories", "team_sponsor_contracts"].includes(query.table))).toBe(false);
    expect(f.inserts).toEqual([]);
  });

  it("prepares only the missing proposal without repricing or rewriting existing objectives", async () => {
    const f = fixture();
    const existing = ["offer-a", "offer-b"].flatMap((id) => Array.from({ length: 3 }, (_, index) => objective(id, index)));
    f.tables.secondary_sponsor_objectives = structuredClone(existing);
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    expect(f.inserts).toHaveLength(1);
    expect(f.inserts[0].rows).toHaveLength(3);
    expect(f.inserts[0].rows.every((row) => row.offer_id === "offer-c")).toBe(true);
    expect(f.tables.secondary_sponsor_objectives.filter((row) => row.offer_id !== "offer-c")).toEqual(existing);
  });

  it("does not generate partial objectives when a later relation batch fails", async () => {
    const f = fixture(160);
    f.state.failRaceId = uuid(80);
    await expect(getSecondarySponsoringStateForAuthUser("user")).rejects.toThrow();
    expect(f.inserts).toEqual([]);
    expect(f.tables.secondary_sponsor_objectives).toEqual([]);
  });

  it("does not send empty IN filters when the season has no eligible race", async () => {
    const f = fixture();
    f.tables.race_editions.forEach((row) => { row.registration_policy = "closed"; });
    await expect(getSecondarySponsoringStateForAuthUser("user")).rejects.toThrow();
    expect(f.queries.some((query) => query.table === "races")).toBe(false);
    expect(f.queries.some((query) => query.filters.some((entry) => entry.kind === "in" && Array.isArray(entry.value) && entry.value.length === 0))).toBe(false);
    expect(f.inserts).toEqual([]);
  });

  it("filters inaccessible, closed and cancelled editions before loading their relations", async () => {
    const f = fixture(7);
    f.tables.race_editions[3].registration_policy = "closed";
    f.tables.race_editions[4].status = "cancelled";
    f.tables.race_editions[5].minimum_reputation = 3_000;
    f.tables.race_editions[6].minimum_reputation = null;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    const requestedRaceIds = f.queries.filter((query) => query.table === "races").flatMap((query) => query.filters.filter((entry) => entry.kind === "in" && entry.column === "id").flatMap((entry) => entry.value as string[]));
    expect([...new Set(requestedRaceIds)].sort()).toEqual([uuid(0), uuid(1), uuid(2)]);
    expect(f.inserts.flatMap((insert) => insert.rows).every((row) => ["race-0", "race-1", "race-2"].includes(String(row.race_slug)))).toBe(true);
  });
});
