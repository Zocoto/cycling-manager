import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamRaceReconnaissanceOverview } from "./team-race-reconnaissance";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

type Row = Record<string, unknown>;
type Fixture = Record<string, Row[]>;
const uuid = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

function calendarFixture(editionCount = 842): Fixture {
  const editions = Array.from({ length: editionCount }, (_, index) => ({
    id: uuid(20_000 + index),
    race_id: uuid(10_000 + index),
    race_category_id: uuid(4),
    display_name: `Course ${index}`,
    season_id: uuid(1),
    status: "planned",
  }));
  return {
    sporting_directors: [{
      id: uuid(2), auth_user_id: uuid(3), status: "active", reputation_points: 100,
    }],
    team_manager_assignments: [{
      team_id: uuid(5), sporting_director_id: uuid(2), role: "general_manager", status: "active",
    }],
    seasons: [{ id: uuid(1), name: "Saison 4", game_year: 2026, current_day_number: 2, status: "active" }],
    team_seasons: [{
      id: uuid(6), team_id: uuid(5), season_id: uuid(1), display_name: "Équipe test",
      cash_balance: "10000", currency: "EUR", registration_country_id: uuid(30_000),
    }],
    season_days: Array.from({ length: 10 }, (_, index) => ({
      id: uuid(40_000 + index), season_id: uuid(1), day_number: index + 1,
      calendar_date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    })),
    rider_contracts: [{ rider_id: uuid(7), team_id: uuid(5), status: "active" }],
    riders: [{
      id: uuid(7), country_id: uuid(30_000), first_name: "Test", last_name: "Coureur",
      avatar_profile_key: null, avatar_seed: null,
    }],
    rider_season_ratings: [{ rider_id: uuid(7), season_id: uuid(1), age: 26 }],
    rider_condition_states: [{
      rider_id: uuid(7), season_day_id: uuid(40_001), form: 80, morale: "70", updated_at: "2026-10-02T00:00:00Z",
    }],
    race_categories: [{ id: uuid(4), code: "elite", name: "Élite" }],
    race_editions: editions,
    races: editions.map((edition, index) => ({
      id: edition.race_id, country_id: uuid(30_000 + index % 120), name: edition.display_name,
      slug: `course-${index}`, race_format: "one_day",
    })),
    stages: editions.map((edition, index) => ({
      id: uuid(50_000 + index), race_edition_id: edition.id, season_day_id: uuid(40_006),
      stage_number: 1, name: `Étape ${index}`, profile_type: "hilly", distance_km: "150", status: "planned",
    })),
    countries: Array.from({ length: 120 }, (_, index) => ({
      id: uuid(30_000 + index), name: `Pays ${index}`, iso_alpha2: "FR", continent_code: "EU",
    })),
    race_registrations: editions.map((edition, index) => ({
      id: uuid(60_000 + index), race_edition_id: edition.id, team_season_id: uuid(6),
      status: index === editionCount - 1 ? "pending" : "accepted", entry_method: "requested",
    })),
    race_rosters: editions.map((_, index) => ({
      id: uuid(70_000 + index), rider_id: uuid(7), race_registration_id: uuid(60_000 + index), status: "selected",
    })),
    stage_reconnaissances: [{
      id: uuid(8), target_stage_id: uuid(50_000 + editionCount - 1), team_season_id: uuid(6),
      preparer_contract_id: null, preparer_level: 0, bonus_points: "2", total_price: "200",
      start_day_number: 3, end_day_number: 4, status: "planned", created_at: "2026-10-02T00:00:00Z",
      interruption_requested_at: null, interruption_effective_day_number: null,
    }],
    stage_reconnaissance_riders: [{ reconnaissance_id: uuid(8), rider_id: uuid(7) }],
  };
}

// Use the real Supabase query builder: emulate URL limits, stable ordering and
// PostgREST's 1,000-row cap locally, never against the production database.
function useFixture(fixture: Fixture, fail?: (table: string, url: URL) => boolean) {
  const requests: URL[] = [];
  const activeByTable = new Map<string, number>();
  const peakByTable = new Map<string, number>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    requests.push(url);
    const active = (activeByTable.get(table) ?? 0) + 1;
    activeByTable.set(table, active);
    peakByTable.set(table, Math.max(peakByTable.get(table) ?? 0, active));
    await Promise.resolve();
    try {
      if (url.toString().length > 8_000 || fail?.(table, url)) {
        return Response.json({ message: "Bad Request" }, { status: 400 });
      }
      if (url.pathname.includes("/rpc/")) return Response.json(0);
      let rows = [...(fixture[table] ?? [])];
      for (const [column, filter] of url.searchParams) {
        if (filter.startsWith("eq.")) rows = rows.filter((row) => String(row[column]) === filter.slice(3));
        if (filter.startsWith("neq.")) rows = rows.filter((row) => String(row[column]) !== filter.slice(4));
        if (filter.startsWith("in.(")) {
          const values = new Set(filter.slice(4, -1).split(","));
          rows = rows.filter((row) => values.has(String(row[column])));
        }
      }
      const order = url.searchParams.get("order")?.split(",") ?? [];
      rows.sort((left, right) => {
        for (const term of order) {
          const [column, direction] = term.split(".");
          const result = String(left[column]).localeCompare(String(right[column]), "en", { numeric: true });
          if (result) return direction === "desc" ? -result : result;
        }
        return 0;
      });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1_000), 1_000);
      return Response.json(rows.slice(offset, offset + limit));
    } finally {
      activeByTable.set(table, (activeByTable.get(table) ?? 1) - 1);
    }
  });
  const client = createClient("https://example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);
  return { requests, peakByTable };
}

beforeEach(() => vi.clearAllMocks());

describe("reconnaissance calendar loading", () => {
  it("opens with the 842-race calendar without oversized UUID filters or lost missions", async () => {
    const fixture = calendarFixture();
    const { requests, peakByTable } = useFixture(fixture);
    const overview = await getCurrentTeamRaceReconnaissanceOverview(uuid(3));

    expect(overview?.stages).toHaveLength(842);
    expect(overview?.riders[0]).toMatchObject({ form: 80, morale: 70, age: 26 });
    expect(overview?.riders[0].registeredRaces).toHaveLength(842);
    expect(overview?.stages.find((stage) => stage.raceEditionId === uuid(20_841)))
      .toMatchObject({ pendingWildcard: true, countryName: "Pays 1" });
    expect(overview?.missions[0]).toMatchObject({
      raceName: "Course 841", stageName: "Étape 841", targetDayNumber: 7,
      riderNames: ["Test Coureur"], status: "planned", bonusPoints: 2, price: 200,
    });
    expect(overview?.balance).toBe(10_000);
    for (const table of ["races", "stages", "countries", "race_rosters", "stage_reconnaissance_riders"]) {
      const queries = requests.filter((url) => url.pathname.endsWith(`/${table}`));
      expect(queries.length).toBeGreaterThan(0);
      expect(peakByTable.get(table)).toBeLessThanOrEqual(2);
      for (const url of queries) {
        expect(url.searchParams.has("order")).toBe(true);
        for (const filter of url.searchParams.values()) {
          if (filter.startsWith("in.(")) expect(filter.slice(4, -1).split(",").length).toBeLessThanOrEqual(40);
        }
      }
    }
    // No booking, cancellation or financial write added to page reads.
    expect(requests.filter((url) => url.pathname.includes("/rpc/")).map((url) => url.pathname))
      .toEqual(["/rest/v1/rpc/settle_current_race_reconnaissances"]);
  });

  it("paginates editions, registrations and a stage batch beyond 1,000 rows", async () => {
    const fixture = calendarFixture(1_005);
    const firstStage = fixture.stages[0];
    fixture.stages.push(...Array.from({ length: 1_100 }, (_, index) => ({
      ...firstStage, id: uuid(80_000 + index), name: `Étape bonus ${index}`, stage_number: index + 2,
    })));
    const { requests } = useFixture(fixture);
    const overview = await getCurrentTeamRaceReconnaissanceOverview(uuid(3));

    expect(overview?.stages).toHaveLength(2_105);
    expect(overview?.riders[0].registeredRaces).toHaveLength(1_005);
    expect(overview?.missions[0].raceName).toBe("Course 1004");
    for (const table of ["race_editions", "race_registrations", "stages"]) {
      expect(requests.some((url) => url.pathname.endsWith(`/${table}`) && url.searchParams.get("offset") === "1000"))
        .toBe(true);
    }
  });

  it("does not return a silently incomplete overview when a later batch fails", async () => {
    const fixture = calendarFixture();
    useFixture(fixture, (table, url) => table === "races" && !!url.searchParams.get("id")?.includes(uuid(10_800)));

    await expect(getCurrentTeamRaceReconnaissanceOverview(uuid(3)))
      .rejects.toThrow("Impossible de charger les courses : Bad Request");
  });

  it("keeps the page usable without registrations, missions or a calendar", async () => {
    const fixture = calendarFixture(0);
    fixture.stage_reconnaissances = [];
    fixture.stage_reconnaissance_riders = [];
    const { requests } = useFixture(fixture);
    const overview = await getCurrentTeamRaceReconnaissanceOverview(uuid(3));

    expect(overview).toMatchObject({ stages: [], missions: [], riders: [{ registeredRaces: [] }] });
    expect(requests.some((url) => ["races", "stages", "race_rosters", "stage_reconnaissance_riders"]
      .some((table) => url.pathname.endsWith(`/${table}`)))).toBe(false);
  });
});
