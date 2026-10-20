import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as Array<{ source: string; args?: Record<string, unknown> }>,
  filters: [] as Array<{ source: string; operator: string; key: string; value: unknown }>,
  compactUnavailable: false,
  client: null as unknown,
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fixture.client }));
import { getActiveSeasonRaceCalendar } from "./race-calendar";

type Client = Parameters<typeof getActiveSeasonRaceCalendar>[0];
const RIDER = "rider";
const MIN_DAY = 4 * 28;
const MAX_DAY = MIN_DAY + 27;

function preparation(start: number, end: number, bonus = 2, status = "completed") {
  return { rider_id: RIDER, preparation_type: "indoor_track", bonus_start_game_day: start,
    bonus_end_game_day: end, rating_bonus: bonus, status };
}

function createClient(): Client {
  function query(source: string, args?: Record<string, unknown>) {
    let rows = [...(fixture.rows[source] ?? [])];
    let from = 0, to = Infinity;
    let error: { message: string } | null = null;
    if (source === "get_race_calendar_rider_context") {
      if (fixture.compactUnavailable) error = { message: "bounded RPC not deployed yet" };
      rows = (fixture.rows.riders ?? []).map((rider) => ({
        ...rider, special_ability_codes: [], championship_titles: [],
        performance_preparations: (fixture.rows.rider_performance_preparations ?? [])
          .filter((row) => row.rider_id === rider.id && row.status !== "cancelled"
            && Number(row.bonus_start_game_day) <= Number(args?.p_max_game_day)
            && Number(row.bonus_end_game_day) >= Number(args?.p_min_game_day)),
      }));
    }
    const result = () => {
      fixture.calls.push({ source, args });
      return { data: error ? null : rows.slice(from, to + 1), error };
    };
    const filter = (operator: string, key: string, value: unknown) => {
      fixture.filters.push({ source, operator, key, value });
      rows = rows.filter((row) => operator === "eq" ? row[key] === value
        : operator === "neq" ? row[key] !== value
          : operator === "in" ? (value as unknown[]).includes(row[key])
            : operator === "lte" ? Number(row[key]) <= Number(value)
              : Number(row[key]) >= Number(value));
      return builder;
    };
    const builder = {
      select: () => builder, order: () => builder,
      eq: (key: string, value: unknown) => filter("eq", key, value),
      neq: (key: string, value: unknown) => filter("neq", key, value),
      in: (key: string, value: unknown[]) => filter("in", key, value),
      lte: (key: string, value: unknown) => filter("lte", key, value),
      gte: (key: string, value: unknown) => filter("gte", key, value),
      range: (start: number, end: number) => { from = start; to = end; return builder; },
      returns: async () => result(),
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data?.[0] ?? null }; },
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  }
  return { from: query, rpc: query } as unknown as Client;
}

async function load() {
  return getActiveSeasonRaceCalendar(fixture.client as Client, new Date("2026-11-05T08:00:00Z"), {
    includeEngagedRiders: true, includeSimulationEnhancements: false,
    includeIneligibleRegionalRaces: true,
  });
}

function riderPreparations(calendar: Awaited<ReturnType<typeof load>>) {
  return calendar!.editions[0].engagedRiders[0].performancePreparations!;
}

describe("race preparation context season window", () => {
  beforeEach(() => {
    fixture.calls = []; fixture.filters = []; fixture.compactUnavailable = false;
    fixture.rows = {
      seasons: [{ id: "season", status: "active", game_year: 4, name: "S4", starts_on: "2026-10-09", ends_on: "2026-11-05", current_day_number: 28 }],
      season_days: [1, 28].map((day) => ({ id: `day-${day}`, season_id: "season", day_number: day, calendar_date: day === 1 ? "2026-10-09" : "2026-11-05", label: `J${day}` })),
      race_editions: [{ id: "edition", season_id: "season", race_id: "race", race_category_id: "continental", host_country_id: null, display_name: "Tour", status: "planned", registration_policy: "open" }],
      races: [{ id: "race", country_id: "fr", name: "Tour", short_name: "Tour", slug: "tour", race_format: "stage_race", competition_type: "standard", is_grand_tour: false, is_monument: false }],
      race_categories: [{ id: "continental", code: "continental", name: "Continental", prestige_rank: 3, minimum_roster_size: 1, maximum_roster_size: 8 }],
      countries: [{ id: "fr", name: "France", iso_alpha2: "FR", continent_code: "EU" }],
      stages: [1, 28].map((day, index) => ({ id: `stage-${day}`, race_edition_id: "edition", stage_number: index + 1, stage_type: "road", profile_type: "flat", distance_km: 100, season_day_id: `day-${day}`, day_slot: "early", departure_at: day === 1 ? "2026-10-09T12:00:00Z" : "2026-11-05T12:00:00Z", status: "planned", name: `Étape ${index + 1}` })),
      get_calendar_engaged_riders: [{ race_edition_id: "edition", rider_id: RIDER, team_id: "team", rider_first_name: "Test", rider_last_name: "Rider", team_name: "Team", team_primary_color: "#176951", team_secondary_color: "#ffffff", age: 25, form: 80, race_role: "leader", mountain: 75, hills: 75, flat: 75, time_trial: 75, cobbles: 75, sprint: 75, acceleration: 75, downhill: 75, endurance: 75, resistance: 75, recovery: 75, breakaway: 75, prologue: 75, equipment_effects: [] }],
      riders: [{ id: RIDER, country_id: "fr", avatar_profile_key: "classic", avatar_seed: 12, career_race_days: 56, height_cm: 182, weight_kg: 72, baseline_weight_kg: 72, physiology_version: 1 }],
      rider_performance_preparations: [
        preparation(MIN_DAY - 6, MIN_DAY - 1, 1),
        preparation(MIN_DAY - 5, MIN_DAY, 1.5),
        preparation(MIN_DAY, MIN_DAY + 5, 2),
        preparation(MIN_DAY + 8, MIN_DAY + 13, 2.5),
        preparation(MAX_DAY, MAX_DAY + 5, 3),
        preparation(MAX_DAY + 1, MAX_DAY + 6, 2),
        preparation(MIN_DAY, MIN_DAY + 5, 3.3, "cancelled"),
      ],
    };
    fixture.client = createClient();
  });

  it("sends full-season bounds in the existing RPC body with no extra database read", async () => {
    const calendar = await load();
    expect(fixture.calls.filter((call) => call.source === "get_race_calendar_rider_context")).toEqual([
      { source: "get_race_calendar_rider_context", args: { p_rider_ids: [RIDER], p_min_game_day: MIN_DAY, p_max_game_day: MAX_DAY } },
    ]);
    expect(fixture.calls.some((call) => call.source === "rider_performance_preparations")).toBe(false);
    expect(fixture.calls.filter((call) => call.source === "seasons")).toHaveLength(1);
    expect(riderPreparations(calendar).map((row) => row.ratingBonus)).toEqual([1.5, 2, 2.5, 3]);
    const rider = calendar!.editions[0].engagedRiders[0];
    expect(rider.careerRaceDays).toBe(56);
    expect(rider.physiology).toEqual({ heightCm: 182, weightKg: 72, baselineWeightKg: 72, physiologyVersion: 1 });
  });

  it("retains both inclusive edges, previous-season carry-over and earlier replays even on J28", async () => {
    const calendar = await load();
    const preparations = riderPreparations(calendar);
    expect(preparations[0]).toMatchObject({ bonusStartGameDay: MIN_DAY - 5, bonusEndGameDay: MIN_DAY });
    expect(preparations.at(-1)).toMatchObject({ bonusStartGameDay: MAX_DAY, bonusEndGameDay: MAX_DAY + 5 });
    expect(calendar!.editions[0].stages.map((stage) => stage.gameDayIndex)).toEqual([MIN_DAY, MAX_DAY]);
    expect(preparations.some((row) => row.bonusStartGameDay === MIN_DAY)).toBe(true);
    expect(preparations.some((row) => row.bonusStartGameDay > MAX_DAY || row.bonusEndGameDay < MIN_DAY)).toBe(false);
  });

  it("uses the same overlap filters before pagination when the new RPC is unavailable", async () => {
    const compact = await load();
    fixture.calls = []; fixture.filters = []; fixture.compactUnavailable = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fallback = await load();
      expect(riderPreparations(fallback)).toEqual(riderPreparations(compact));
      expect(fixture.filters.filter((filter) => filter.source === "rider_performance_preparations")).toEqual([
        { source: "rider_performance_preparations", operator: "in", key: "rider_id", value: [RIDER] },
        { source: "rider_performance_preparations", operator: "neq", key: "status", value: "cancelled" },
        { source: "rider_performance_preparations", operator: "lte", key: "bonus_start_game_day", value: MAX_DAY },
        { source: "rider_performance_preparations", operator: "gte", key: "bonus_end_game_day", value: MIN_DAY },
      ]);
      expect(fixture.calls.filter((call) => call.source === "rider_performance_preparations")).toHaveLength(1);
    } finally { warning.mockRestore(); }
  });

  it("does not paginate thousands of obsolete preparations in the fallback", async () => {
    fixture.rows.rider_performance_preparations.unshift(...Array.from({ length: 1500 }, (_, index) => preparation(index - 2000, index - 1995)));
    fixture.compactUnavailable = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(riderPreparations(await load())).toHaveLength(4);
      expect(fixture.calls.filter((call) => call.source === "rider_performance_preparations")).toHaveLength(1);
    } finally { warning.mockRestore(); }
  });

  it.each([2, 3, 5, 10])("derives year %s bounds from the loaded season, never the wall clock", async (year) => {
    fixture.rows.seasons[0].game_year = year;
    await load();
    expect(fixture.calls.find((call) => call.source === "get_race_calendar_rider_context")?.args).toEqual({
      p_rider_ids: [RIDER], p_min_game_day: year * 28, p_max_game_day: year * 28 + 27,
    });
  });
});
