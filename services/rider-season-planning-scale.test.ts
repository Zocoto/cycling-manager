import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createAdmin,
}));

import { getCurrentTeamRiderSeasonPlanning } from "./rider-season-planning";

type Row = Record<string, unknown>;
type Filter = { column: string; kind: "eq" | "neq" | "in" | "gt"; value: unknown };
type QueryCall = { table: string; filters: Filter[]; range?: [number, number] };
const uuid = (kind: number, number: number) =>
  `${kind.toString().padStart(8, "0")}-0000-4000-8000-${number.toString().padStart(12, "0")}`;
const riderId = uuid(1, 1);
const seasonId = uuid(2, 1);
const teamId = uuid(3, 1);
const teamSeasonId = uuid(4, 1);
const countryId = uuid(5, 1);
const categoryId = uuid(6, 1);

class PlanningClient {
  readonly calls: QueryCall[] = [];
  readonly errors = new Map<string, string>();
  readonly rpc = vi.fn(() => {
    throw new Error("A planning view must not mutate gameplay");
  });

  constructor(readonly rows: Record<string, Row[]>) {}

  from(table: string) {
    return new PlanningQuery(this, table);
  }
}

class PlanningQuery {
  private readonly filters: Filter[] = [];
  private readonly orders: string[] = [];
  private bounds?: [number, number];

  constructor(private readonly client: PlanningClient, private readonly table: string) {}

  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, value, kind: "eq" }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, value, kind: "neq" }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, value, kind: "gt" }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ column, value, kind: "in" }); return this; }
  order(column: string) { this.orders.push(column); return this; }
  range(start: number, end: number) { this.bounds = [start, end]; return this; }

  private async execute(single = false) {
    this.client.calls.push({ table: this.table, filters: this.filters, range: this.bounds });
    const oversized = this.filters.some((filter) =>
      filter.kind === "in" && (filter.value as unknown[]).length > 75,
    );
    const message = this.client.errors.get(this.table) ?? (oversized ? "Bad Request" : null);
    if (message) return { data: null, error: { message } };
    const matching = (this.client.rows[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.column];
        if (filter.kind === "eq") return value === filter.value;
        if (filter.kind === "neq") return value !== filter.value;
        if (filter.kind === "in") return (filter.value as unknown[]).includes(value);
        return String(value) > String(filter.value);
      }),
    ).sort((left, right) => {
      for (const key of this.orders) {
        const comparison = String(left[key]).localeCompare(String(right[key]));
        if (comparison) return comparison;
      }
      return 0;
    });
    const [start, end] = this.bounds ?? [0, 999];
    const page = matching.slice(start, end + 1);
    return { data: single ? page[0] ?? null : page, error: null };
  }

  returns<T>() {
    return this.execute() as Promise<{ data: T | null; error: { message: string } | null }>;
  }
  maybeSingle<T>() {
    return this.execute(true) as Promise<{ data: T | null; error: { message: string } | null }>;
  }
}

function fixture(editionCount = 845) {
  const client = new PlanningClient({
    sporting_directors: [{ id: uuid(7, 1), auth_user_id: "manager", status: "active" }],
    team_manager_assignments: [{ sporting_director_id: uuid(7, 1), team_id: teamId, role: "general_manager", status: "active" }],
    seasons: [{ id: seasonId, name: "Saison 4", current_day_number: 1, status: "active" }],
    team_seasons: [{ id: teamSeasonId, team_id: teamId, season_id: seasonId, display_name: "Test team" }],
    season_days: Array.from({ length: 28 }, (_, index) => ({
      id: uuid(8, index + 1), season_id: seasonId, day_number: index + 1,
      calendar_date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    })),
    rider_contracts: [{ rider_id: riderId, team_id: teamId, status: "active" }],
    riders: [{ id: riderId, country_id: countryId, first_name: "Test", last_name: "Rider", avatar_profile_key: null, avatar_seed: 1 }],
    rider_season_ratings: [{ rider_id: riderId, season_id: seasonId, age: 25 }],
    countries: [{ id: countryId, name: "France", iso_alpha2: "FR" }],
    race_categories: [{ id: categoryId, code: "world", name: "Mondiale" }],
    race_editions: Array.from({ length: editionCount }, (_, index) => ({
      id: uuid(9, index + 1), race_id: uuid(10, index + 1), race_category_id: categoryId,
      season_id: seasonId, display_name: `Course ${index + 1}`, status: "scheduled",
    })),
    races: Array.from({ length: editionCount }, (_, index) => ({
      id: uuid(10, index + 1), name: `Course ${index + 1}`, slug: `course-${index + 1}`, race_format: "one_day",
    })),
  });
  return client;
}

function register(client: PlanningClient, editionNumber: number, options: { federal?: boolean; stages?: number; status?: string } = {}) {
  const registrationId = uuid(11, editionNumber);
  (client.rows.race_registrations ??= []).push({
    id: registrationId, race_edition_id: uuid(9, editionNumber),
    team_season_id: options.federal ? null : teamSeasonId, status: options.status ?? "accepted",
  });
  (client.rows.race_rosters ??= []).push({
    rider_id: riderId, race_registration_id: registrationId, status: "confirmed",
  });
  if (options.federal) {
    (client.rows.national_federation_selection_race_links ??= []).push({
      race_registration_id: registrationId, race_edition_id: uuid(9, editionNumber),
    });
  }
  for (let number = 1; number <= (options.stages ?? 1); number++) {
    (client.rows.stages ??= []).push({
      id: uuid(12, editionNumber * 100 + number), race_edition_id: uuid(9, editionNumber),
      season_day_id: uuid(8, number), stage_number: number, name: `Étape ${number}`, status: "scheduled",
    });
  }
}

describe("rider planning with large season calendars", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads an 845-race calendar without requesting all race identities or writing gameplay", async () => {
    const client = fixture();
    register(client, 845);
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders[0].events).toMatchObject([{ title: "Course 845", href: "/jeu/courses/course-845" }]);
    expect(client.calls.filter((call) => call.table === "races")).toHaveLength(1);
    expect(client.calls.find((call) => call.table === "races")?.filters).toEqual([
      { column: "id", kind: "in", value: [uuid(10, 845)] },
    ]);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not lose registrations beyond the API's default 1,000-row limit", async () => {
    const client = fixture(1105);
    register(client, 1105);
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager", riderId });
    expect(result?.riders[0].events[0].title).toBe("Course 1105");
    expect(client.calls.filter((call) => call.table === "race_editions").map((call) => call.range))
      .toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("batches identities and paginates stages without losing the last day of long tours", async () => {
    const client = fixture();
    for (let index = 1; index <= 150; index++) register(client, index, { stages: 12 });
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders[0].events).toHaveLength(150);
    expect(result?.riders[0].events.every((event) => event.startDay === 1 && event.endDay === 12)).toBe(true);
    expect(client.calls.filter((call) => call.table === "races")).toHaveLength(2);
    expect(client.calls.some((call) => call.table === "stages" && call.range?.[0] === 500)).toBe(true);
    for (const call of client.calls) {
      for (const filter of call.filters) {
        if (filter.kind === "in") expect((filter.value as unknown[]).length).toBeLessThanOrEqual(75);
      }
    }
  });

  it("retains national call-ups and pending club wildcard registrations", async () => {
    const client = fixture();
    register(client, 1, { status: "pending" });
    register(client, 845, { federal: true });
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders[0].events).toHaveLength(2);
    expect(result?.riders[0].events.find((event) => event.title === "Course 1")?.detail).toContain("Inscription en attente");
    expect(result?.riders[0].events.find((event) => event.title === "Course 845")?.detail).toContain("Inscription confirmée");
  });

  it("keeps reconnaissance and injury source stages even without a race registration", async () => {
    const client = fixture();
    client.rows.stages = [{ id: uuid(12, 1), race_edition_id: uuid(9, 845), season_day_id: uuid(8, 10), stage_number: 1, name: "Finale", status: "scheduled" }];
    client.rows.stage_reconnaissances = [{ id: uuid(13, 1), team_season_id: teamSeasonId, target_stage_id: uuid(12, 1), bonus_points: 2, start_day_number: 8, end_day_number: 9, status: "planned" }];
    client.rows.stage_reconnaissance_riders = [{ reconnaissance_id: uuid(13, 1), rider_id: riderId, form_camp_id: uuid(14, 1) }];
    client.rows.rider_injuries = [{ id: uuid(15, 1), rider_id: riderId, source_stage_id: uuid(12, 1), diagnosis_code: "legacy_contusion", status: "active", started_at: "2026-10-01T12:00:00Z", expected_recovery_at: "2099-10-10T12:00:00Z" }];
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders[0].events.map((event) => event.type).sort()).toEqual(["injury", "reconnaissance"]);
    expect(result?.riders[0].events.find((event) => event.type === "reconnaissance")?.title).toBe("Reconnaissance · Course 845");
    expect(result?.riders[0].events.find((event) => event.type === "injury")?.detail).toContain("Course 845");
  });

  it("keeps a national selection beyond 1,000 federation links and excludes other teams' riders", async () => {
    const client = fixture();
    register(client, 845, { federal: true });
    client.rows.race_registrations[0].id = uuid(11, 9999);
    client.rows.race_rosters[0].race_registration_id = uuid(11, 9999);
    client.rows.national_federation_selection_race_links[0].race_registration_id = uuid(11, 9999);
    for (let number = 1; number <= 1100; number++) {
      client.rows.race_registrations.push({ id: uuid(11, number), race_edition_id: uuid(9, 845), status: "accepted", team_season_id: null });
      client.rows.national_federation_selection_race_links.push({ race_registration_id: uuid(11, number), race_edition_id: uuid(9, 845) });
      client.rows.race_rosters.push({ rider_id: uuid(1, 2), race_registration_id: uuid(11, number), status: "confirmed" });
    }
    mocks.createAdmin.mockReturnValue(client);
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders).toHaveLength(1);
    expect(result?.riders[0].events).toMatchObject([{ title: "Course 845" }]);
    expect(client.calls.some((call) => call.table === "national_federation_selection_race_links" && call.range?.[0] === 1000)).toBe(true);
  });

  it("does not turn a real query error into a misleading empty planning", async () => {
    const client = fixture();
    register(client, 845);
    client.errors.set("races", "Unavailable");
    mocks.createAdmin.mockReturnValue(client);
    await expect(getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" }))
      .rejects.toThrow("Impossible de charger les identités des courses : Unavailable");
  });

  it("refuses another team's rider and avoids loading race details for an empty roster", async () => {
    const client = fixture();
    mocks.createAdmin.mockReturnValue(client);
    expect(await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager", riderId: "not-owned" })).toBeNull();
    client.rows.rider_contracts = [];
    const result = await getCurrentTeamRiderSeasonPlanning({ authUserId: "manager" });
    expect(result?.riders).toEqual([]);
    expect(client.calls.some((call) => ["races", "stages"].includes(call.table))).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
