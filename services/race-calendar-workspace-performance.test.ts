import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRacePreparationStageAvailable } from "@/lib/game/race-preparation";
import { PROFESSIONAL_NATIONS_CUP_EVENTS } from "@/lib/game/nations-cup-heats";

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

function addNationsCupHeat(
  slug: string,
  clubCount: number,
  options: { editionStatus?: string; stageStatus?: string } = {},
) {
  fixture.rows.races.push({
    id: slug, slug, country_id: "fr", name: slug, short_name: slug,
    race_format: "one_day", competition_type: "nations_cup",
    is_grand_tour: false, is_monument: false,
  });
  fixture.rows.race_editions.push({
    id: slug, season_id: "season", race_id: slug, host_country_id: null,
    race_category_id: "continental", display_name: slug,
    status: options.editionStatus ?? "planned", registration_policy: "closed",
  });
  fixture.rows.stages.push({
    id: `stage-${slug}`, race_edition_id: slug, stage_number: 1,
    stage_type: "road", profile_type: "flat", distance_km: 50,
    season_day_id: "day-7", day_slot: "early",
    departure_at: "2026-10-15T12:00:00Z",
    status: options.stageStatus ?? "planned", name: slug,
  });
  fixture.rows.get_current_team_visible_calendar_edition_ids.push({ race_edition_id: slug });
  if (clubCount > 0) {
    (fixture.rows.get_current_team_international_calendar_counts ??= []).push({
      race_edition_id: slug, rider_category: "professional", engaged_rider_count: clubCount,
    });
  }
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
      stage_reconnaissance_targets: [{ id: "recon", target_stage_id: "road", bonus_points: 3, status: "completed" }],
      stage_reconnaissance_riders: [{ reconnaissance_id: "recon", rider_id: "rider" }],
      national_federation_infrastructures: [{ country_id: "fr", infrastructure_code: "home_advantage_program", level: 3 }],
      national_federation_infrastructure_specializations: [{ country_id: "fr", infrastructure_code: "home_advantage_program", active_specialization_code: "home_roads" }],
    };
    fixture.client = client();
  });
  it("applies one double reconnaissance mission to both target stages without extra reads", async () => {
    fixture.rows.stage_reconnaissance_targets.push({ id: "recon", target_stage_id: "tt", bonus_points: 3, status: "completed" });
    const calendar = await getActiveSeasonRaceCalendar(fixture.client as Client, now, { includeEngagedRiders: false });
    const stages = calendar!.editions.find(edition => edition.id === "tour")!.stages;
    expect(stages.find(stage => stage.id === "road")!.reconnaissanceBonuses).toEqual({ rider: 3 });
    expect(stages.find(stage => stage.id === "tt")!.reconnaissanceBonuses).toEqual({ rider: 3 });
    expect(fixture.reads.filter(table => table === "stage_reconnaissance_riders")).toHaveLength(1);
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
    const simulationTables = ["stage_reconnaissance_targets", "stage_reconnaissance_riders", "national_federation_infrastructures", "national_federation_infrastructure_specializations"];
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
    expect(fixture.reads).not.toContain("stage_reconnaissance_targets");
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
    addNationsCupHeat("nations-cup-montagne", 0);
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

  it("preserves 35 club selections across all five disciplines and national heats before hiding secondary heats", async () => {
    const pools = ["", "-d2-a", "-d2-b", "-d3-a", "-d3-b", "-d4-a", "-d4-b", "-d4-c"];
    for (const event of PROFESSIONAL_NATIONS_CUP_EVENTS) {
      for (const [index, pool] of pools.entries()) {
        // The authenticated RPC already groups club riders across nationalities.
        // Seven national selections per profile must survive hiding their heats.
        addNationsCupHeat(`${event.slug}${pool}`, index < 7 ? 1 : 0);
      }
      fixture.rows.get_current_team_calendar_registrations.push({
        race_edition_id: event.slug, registration_status: "accepted", roster_count: 5,
      });
    }
    // RPC and edition identity are each counted once, never summed twice.
    fixture.rows.get_current_team_international_calendar_counts.push({
      ...fixture.rows.get_current_team_international_calendar_counts[0],
    });
    fixture.rows.race_editions.push({
      ...fixture.rows.race_editions.find((edition) => edition.id === "nations-cup-montagne-d2-a")!,
    });
    fixture.rows.get_current_team_international_calendar_counts.push({
      race_edition_id: "nations-cup-montagne-d2-a", rider_category: "junior", engaged_rider_count: 500,
    });
    addNationsCupHeat("nations-cup-montagne-d2-c", 500, { editionStatus: "cancelled" });
    addNationsCupHeat("nations-cup-montagne-d3-c", 500, { stageStatus: "cancelled" });
    // Withdrawn/refused federation rosters are absent from the authenticated
    // counts RPC and must not be substituted for the club's engaged riders.
    fixture.rows.get_current_team_calendar_registrations.push(
      { race_edition_id: "nations-cup-montagne-d4-c", registration_status: "withdrawn", roster_count: 200 },
      { race_edition_id: "nations-cup-vallons-d4-c", registration_status: "rejected", roster_count: 200 },
    );
    const calendar = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
      includeEngagedRiders: false, includeCancelledEditions: true,
    });
    const disciplines = calendar!.editions.filter((edition) =>
      PROFESSIONAL_NATIONS_CUP_EVENTS.some((event) => event.slug === edition.slug),
    );
    expect(disciplines).toHaveLength(5);
    expect(disciplines.map((edition) => edition.currentTeamInternationalRiderCount)).toEqual([7, 7, 7, 7, 7]);
    expect(disciplines.reduce((sum, edition) => sum + edition.currentTeamInternationalRiderCount!, 0)).toBe(35);
    expect(calendar!.editions.some((edition) => /-d[2-4]-[a-c]$/.test(edition.slug))).toBe(false);
    expect(fixture.reads.filter((read) => read === "get_current_team_international_calendar_counts")).toHaveLength(1);
    expect(fixture.reads).not.toContain("race_rosters");
    expect(fixture.reads).not.toContain("rider_contracts");
    expect(fixture.reads).not.toContain("get_calendar_engaged_riders");
  });

  it.each(["absent", "cancelled", "cancelled-stage"] as const)(
    "keeps one active representative when the main Nations Cup heat is %s",
    async (mainStatus) => {
      if (mainStatus !== "absent") {
        addNationsCupHeat("nations-cup-montagne", 100, mainStatus === "cancelled"
          ? { editionStatus: "cancelled" }
          : { stageStatus: "cancelled" });
      }
      addNationsCupHeat("nations-cup-montagne-d2-a", 3);
      addNationsCupHeat("nations-cup-montagne-d2-b", 4);
      const calendar = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
        includeEngagedRiders: false, includeCancelledEditions: true,
      });
      const representatives = calendar!.editions.filter((edition) => edition.slug.startsWith("nations-cup-montagne"));
      expect(representatives).toHaveLength(1);
      expect(representatives[0]).toMatchObject({
        slug: "nations-cup-montagne-d2-a", currentTeamInternationalRiderCount: 7,
      });
      expect(fixture.reads.filter((read) => read === "get_current_team_international_calendar_counts")).toHaveLength(1);
    },
  );

  it("retains exact per-heat club counts for complete heat loaders and targeted race pages", async () => {
    addNationsCupHeat("nations-cup-montagne", 2);
    addNationsCupHeat("nations-cup-montagne-d2-a", 3);
    const complete = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
      includeEngagedRiders: false, includeNationsCupHeats: true,
    });
    expect(complete!.editions.find((edition) => edition.slug === "nations-cup-montagne")?.currentTeamInternationalRiderCount).toBe(2);
    expect(complete!.editions.find((edition) => edition.slug === "nations-cup-montagne-d2-a")?.currentTeamInternationalRiderCount).toBe(3);
    const targeted = await getActiveSeasonRaceCalendar(fixture.client as Client, now, {
      includeEngagedRiders: false, raceSlug: "nations-cup-montagne",
    });
    expect(targeted!.editions).toHaveLength(1);
    expect(targeted!.editions[0].currentTeamInternationalRiderCount).toBe(2);
  });
});
