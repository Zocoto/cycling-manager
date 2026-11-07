import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRacePreparationStageAvailable } from "@/lib/game/race-preparation";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>, reads: [] as string[],
  filters: [] as Array<{ table: string; key: string; values: unknown[] }>,
  returnedRows: [] as Array<{ table: string; count: number }>,
  client: null as unknown,
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fixture.client }));
import { getActiveSeasonRaceCalendar, getRacePreparationCalendar, type RacePreparationEditionPlan } from "./race-calendar";

type Client = Parameters<typeof getActiveSeasonRaceCalendar>[0];
function preparationPlan(editionId: string): RacePreparationEditionPlan {
  return { editionId, registrationId: `registration-${editionId}`, teamId: "team", riders: [], stages: {} };
}
function client(): Client {
  function query(table: string) {
    let rows = [...(fixture.rows[table] ?? [])];
    let from = 0, to = Infinity;
    const result = () => {
      fixture.reads.push(table);
      const data = rows.slice(from, to + 1);
      fixture.returnedRows.push({ table, count: data.length });
      return { data, error: null };
    };
    const builder = {
      select: () => builder, order: () => builder,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return builder; },
      neq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] !== value); return builder; },
      in: (key: string, values: unknown[]) => {
        fixture.filters.push({ table, key, values });
        rows = rows.filter(row => values.includes(row[key])); return builder;
      },
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
    fixture.filters = [];
    fixture.returnedRows = [];
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
    for (const table of simulationTables) expect(fixture.reads).not.toContain(table);
    expect(baselineReads.length - fixture.reads.length).toBeGreaterThanOrEqual(4);
    // Defaults still preserve simulation data for every existing caller.
    expect(baseline!.editions.find(e => e.id === "tour")!.stages[0].reconnaissanceBonuses).toEqual({ rider: 3 });
    expect(baseline!.editions.find(e => e.id === "tour")!.federationHomeAdvantageBonus).toBeGreaterThan(0);
  });
  it("loads only registered preparation editions and skips the entire calendar when there is no plan", async () => {
    const plans = [preparationPlan("tour"), preparationPlan("tour")];
    const baseline = await getActiveSeasonRaceCalendar(fixture.client as Client, now, { includeEngagedRiders: false });
    const before = [...fixture.reads];
    const beforeRows = [...fixture.returnedRows];
    fixture.reads = [];
    fixture.filters = [];
    fixture.returnedRows = [];
    const scoped = await getRacePreparationCalendar(fixture.client as Client, now, plans);
    expect(scoped?.editions.map((edition) => edition.id)).toEqual(["tour"]);
    const displayedStage = (stage: NonNullable<typeof scoped>["editions"][number]["stages"][number]) => ({
      id: stage.id, name: stage.name, stageType: stage.stageType, profileType: stage.profileType,
      departureAt: stage.departureAt, distanceKm: stage.distanceKm, segments: stage.segments,
    });
    expect(scoped!.editions[0].stages.map(displayedStage)).toEqual(baseline!.editions.find((edition) => edition.id === "tour")!.stages.map(displayedStage));
    const workspaceData = (edition: NonNullable<typeof scoped>["editions"][number]) => {
      const {
        engagedRiderCount, currentTeamInternationalRiderCount,
        federationHomeAdvantageBonus, federationHomeAdvantageSpecialization, ...displayed
      } = edition;
      void engagedRiderCount; void currentTeamInternationalRiderCount;
      void federationHomeAdvantageBonus; void federationHomeAdvantageSpecialization;
      return { ...displayed, stages: displayed.stages.map(({ reconnaissanceBonuses, ...stage }) => {
        void reconnaissanceBonuses;
        return stage;
      }) };
    };
    expect(workspaceData(scoped!.editions[0])).toEqual(workspaceData(baseline!.editions.find((edition) => edition.id === "tour")!));
    expect(fixture.filters).toEqual(expect.arrayContaining([
      { table: "race_editions", key: "id", values: ["tour"] },
      { table: "races", key: "id", values: ["tour"] },
      { table: "stages", key: "race_edition_id", values: ["tour"] },
      { table: "stage_segments", key: "stage_id", values: ["road", "tt"] },
    ]));
    expect(fixture.returnedRows.find((read) => read.table === "race_editions")?.count).toBe(1);
    expect(fixture.returnedRows.find((read) => read.table === "stages")?.count).toBe(2);
    expect(beforeRows.find((read) => read.table === "race_editions")?.count).toBe(4);
    expect(beforeRows.find((read) => read.table === "stages")?.count).toBe(5);
    expect(fixture.reads).not.toContain("get_current_team_visible_calendar_edition_ids");
    expect(fixture.reads).not.toContain("get_active_calendar_engaged_counts");
    expect(fixture.reads).not.toContain("get_current_team_international_calendar_counts");
    expect(fixture.reads).not.toContain("stage_reconnaissances");
    expect(before).toHaveLength(19);
    expect(fixture.reads).toHaveLength(12);
    fixture.reads = [];
    expect(await getRacePreparationCalendar(fixture.client as Client, now, [])).toBeNull();
    expect(fixture.reads).toEqual([]);
  });
  it("marks each sponsor independently with one calendar objective lookup", async () => {
    fixture.rows.get_current_team_calendar_sponsor_objective_races = [
      { race_edition_id: "tour", sponsor_role: "principal" },
      { race_edition_id: "tour", sponsor_role: "secondary" },
      { race_edition_id: "classic", sponsor_role: "secondary" },
    ];
    const calendar = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
      includeEngagedRiders: false,
      includeSecondarySponsorObjectives: true,
    });
    expect(calendar?.editions.find((edition) => edition.id === "tour")).toMatchObject({
      isSponsorObjective: true,
      isSecondarySponsorObjective: true,
    });
    expect(calendar?.editions.find((edition) => edition.id === "classic")).toMatchObject({
      isSponsorObjective: false,
      isSecondarySponsorObjective: true,
    });
    expect(calendar?.editions.find((edition) => edition.id === "wildcard")?.isSecondarySponsorObjective).toBeUndefined();
    expect(fixture.reads.filter((read) => read.includes("sponsor_objective_races"))).toEqual([
      "get_current_team_calendar_sponsor_objective_races",
    ]);
  });

  it("preserves pending wildcards and authorized national heats omitted from the calendar grid", async () => {
    fixture.rows.races.find((race) => race.id === "international")!.slug = "nations-cup-montagne-d2-a";
    const grid = await getActiveSeasonRaceCalendar(fixture.client as Client, now, { includeEngagedRiders: false });
    expect(grid?.editions.map((edition) => edition.id)).not.toContain("international");
    const plans = [preparationPlan("wildcard"), preparationPlan("international")];
    fixture.reads = [];
    const scoped = await getRacePreparationCalendar(fixture.client as Client, now, plans);
    expect(scoped?.editions.map((edition) => edition.id)).toEqual(["wildcard", "international"]);
    expect(scoped!.editions[0].currentTeamRegistration?.status).toBe("pending");
    expect(scoped!.editions[1].competitionType).toBe("nations_cup");
    expect(scoped!.editions[1].stages[0].id).toBe("international");
    expect(fixture.reads).not.toContain("get_calendar_engaged_riders");
    expect(fixture.reads).not.toContain("get_active_calendar_engaged_counts");
  });
});
