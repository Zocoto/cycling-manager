import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRacePreparationStageAvailable } from "@/lib/game/race-preparation";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>, reads: [] as string[],
  client: null as unknown,
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fixture.client }));
import { getActiveSeasonRaceCalendar } from "./race-calendar";

type Client = Parameters<typeof getActiveSeasonRaceCalendar>[0];
function client(): Client {
  function query(table: string) {
    let rows = [...(fixture.rows[table] ?? [])];
    let from = 0, to = Infinity;
    const result = () => {
      fixture.reads.push(table);
      return { data: rows.slice(from, to + 1), error: null };
    };
    const builder = {
      select: () => builder, order: () => builder,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return builder; },
      neq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] !== value); return builder; },
      in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return builder; },
      range: (start: number, end: number) => { from = start; to = end; return builder; },
      returns: async () => result(),
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data[0] ?? null }; },
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  }
  return { from: query, rpc: query } as unknown as Client;
}

describe("preparation calendar without unused simulation data", () => {
  const now = new Date("2026-10-14T08:00:00Z");
  beforeEach(() => {
    fixture.reads = [];
    fixture.rows = {
      seasons: [{ id: "season", status: "active", game_year: 4, name: "S4", starts_on: "2026-10-09", ends_on: "2026-11-05", current_day_number: 6 }],
      season_days: [6, 7].map(day => ({ id: `day-${day}`, season_id: "season", day_number: day, calendar_date: `2026-10-${day + 8}`, label: `J${day}` })),
      race_editions: ["tour", "classic", "wildcard", "international"].map(id => ({ id, season_id: "season", race_id: id, host_country_id: null,
        race_category_id: id === "wildcard" ? "elite" : "continental", display_name: id, status: "planned", registration_policy: "open" })),
      races: ["tour", "classic", "wildcard", "international"].map(id => ({ id, country_id: "fr", name: id, short_name: id, slug: id,
        race_format: id === "classic" ? "one_day" : "stage_race", competition_type: id === "international" ? "nations_cup" : "standard", is_grand_tour: false, is_monument: false })),
      race_categories: ["continental", "elite"].map(code => ({ id: code, code, name: code, prestige_rank: 3, minimum_roster_size: 1, maximum_roster_size: 8 })),
      countries: [{ id: "fr", name: "France", iso_alpha2: "FR", continent_code: "EU" }],
      get_current_team_visible_calendar_edition_ids: ["tour", "classic", "wildcard", "international"].map(id => ({ race_edition_id: id })),
      get_current_team_calendar_registrations: ["tour", "classic", "wildcard"].map(id => ({ race_edition_id: id, registration_status: id === "wildcard" ? "pending" : "confirmed", roster_count: 8 })),
      get_active_calendar_engaged_counts: [{ race_edition_id: "tour", engaged_rider_count: 40 }],
      stages: [
        { id: "road", race_edition_id: "tour", stage_number: 1, stage_type: "road", profile_type: "mountain", distance_km: 100, season_day_id: "day-6", day_slot: "early", departure_at: "2026-10-14T12:00:00Z", status: "planned", name: "Montagne" },
        { id: "tt", race_edition_id: "tour", stage_number: 2, stage_type: "team_time_trial", profile_type: "flat", distance_km: 30, season_day_id: "day-6", day_slot: "late", departure_at: "2026-10-14T16:00:00Z", status: "planned", name: "CLM" },
        ...["classic", "wildcard", "international"].map(id => ({ id, race_edition_id: id, stage_number: 1, stage_type: "road", profile_type: "flat", distance_km: 100,
          season_day_id: "day-7", day_slot: "early", departure_at: "2026-10-15T12:00:00Z", status: "planned", name: id })),
      ],
      stage_segments: [
        { id: "s1", stage_id: "road", segment_number: 1, distance_km: 50, terrain_type: "flat", surface_type: "asphalt", average_gradient_pct: 0, stage_segment_primes: [] },
        { id: "s2", stage_id: "road", segment_number: 2, distance_km: 50, terrain_type: "mountain", surface_type: "asphalt", average_gradient_pct: 7,
          stage_segment_primes: [{ prime_type: "mountain", mountain_category: "1", points_scale: [10, 6, 4] }] },
      ],
      stage_reconnaissances: [{ id: "recon", target_stage_id: "road", bonus_points: 3, status: "completed" }],
      stage_reconnaissance_riders: [{ reconnaissance_id: "recon", rider_id: "rider" }],
      national_federation_infrastructures: [{ country_id: "fr", infrastructure_code: "home_advantage_program", level: 3 }],
      national_federation_infrastructure_specializations: [{ country_id: "fr", infrastructure_code: "home_advantage_program", active_specialization_code: "home_roads" }],
    };
    fixture.client = client();
  });
  it("preserves all data consumed by navigation, equipment and complete stage profiles", async () => {
    const baseline = await getActiveSeasonRaceCalendar(fixture.client as Client, now, { includeEngagedRiders: false });
    const baselineReads = [...fixture.reads]; fixture.reads = [];
    const optimized = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
      includeEngagedRiders: false, includeSimulationEnhancements: false,
    });
    // Only the unused simulation properties are deliberately different.
    const displayedData = (calendar: typeof baseline) => calendar && ({ ...calendar, editions: calendar.editions.map(edition => {
      const { federationHomeAdvantageBonus, federationHomeAdvantageSpecialization, ...displayed } = edition;
      void federationHomeAdvantageBonus; void federationHomeAdvantageSpecialization;
      return { ...displayed, stages: displayed.stages.map(stage => {
        const { reconnaissanceBonuses, ...profile } = stage; void reconnaissanceBonuses;
        return profile;
      }) };
    }) });
    expect(displayedData(optimized)).toEqual(displayedData(baseline));
    expect(optimized?.editions).toHaveLength(4);
    const tour = optimized!.editions.find(e => e.id === "tour")!;
    expect(tour.stages.map(s => s.stageType)).toEqual(["road", "team_time_trial"]);
    expect(tour.stages[0].segments).toHaveLength(2);
    expect(tour.stages[0].segments[1].prime?.type).toBe("mountain");
    expect(tour.stages[1].segments.reduce((sum, s) => sum + s.distanceKm, 0)).toBe(30);
    expect(optimized!.editions.find(e => e.id === "wildcard")!.currentTeamRegistration?.status).toBe("pending");
    expect(isRacePreparationStageAvailable({ edition: optimized!.editions.find(e => e.id === "international")!, stage: tour.stages[0] })).toBe(false);
    const simulationTables = ["stage_reconnaissances", "stage_reconnaissance_riders", "national_federation_infrastructures", "national_federation_infrastructure_specializations"];
    expect(baselineReads).toEqual(expect.arrayContaining(simulationTables));
    expect(fixture.reads).not.toEqual(expect.arrayContaining(simulationTables));
    expect(baselineReads.length - fixture.reads.length).toBeGreaterThanOrEqual(4);
    // Defaults still preserve simulation data for every existing caller.
    expect(baseline!.editions.find(e => e.id === "tour")!.stages[0].reconnaissanceBonuses).toEqual({ rider: 3 });
    expect(baseline!.editions.find(e => e.id === "tour")!.federationHomeAdvantageBonus).toBeGreaterThan(0);
  });
});
