import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  filters: [] as Array<{ table: string; column: string; values: unknown[] }>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      let rows = [...(database.rows[table] ?? [])];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        neq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] !== value);
          return query;
        },
        lte(column: string, value: number) {
          rows = rows.filter((row) => Number(row[column]) <= value);
          return query;
        },
        in(column: string, values: unknown[]) {
          database.filters.push({ table, column, values });
          rows = rows.filter((row) => values.includes(row[column]));
          return query;
        },
        order() { return query; },
        range(from: number, to: number) {
          rows = rows.slice(from, to + 1);
          return query;
        },
        async returns() { return { data: rows.slice(0, 1_000), error: null }; },
        async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      };
      return query;
    },
  }),
}));

import { getFederationSelectionForecasts } from "./federation-selection-weather";
import { buildRaceSegments } from "@/lib/game/race-profiles";

function slot(slotKey: string, competitionCode: string, profileLabel = "Route", riderCategory = "professional") {
  return {
    slot_key: slotKey, competition_code: competitionCode,
    profile_label: profileLabel, rider_category: riderCategory,
    host_country_code: "NL", day_number: 15, active_from_game_year: 3,
  };
}

function proRace(id: string, competitionType = "continental_championship", continent: string | null = "europe") {
  database.rows.races.push({
    id, slug: id, race_format: "one_day", country_id: "nl", competition_type: competitionType,
    championship_continent_code: continent,
  });
  database.rows.race_editions.push({
    id: `${id}-edition`, race_id: id, season_id: "s3", host_country_id: "ma", status: "planned",
  });
}

function stage(id: string, raceId: string, profileType = "hilly", stageType = "road") {
  database.rows.stages.push({
    id, race_edition_id: `${raceId}-edition`, season_day_id: "j15", name: id,
    profile_type: profileType, stage_type: stageType, distance_km: "20", status: "planned",
  });
}

const load = () => getFederationSelectionForecasts({
  countryId: "nl", seasonId: "s3", gameYear: 3, currentDayNumber: 1,
});

beforeEach(() => {
  database.filters = [];
  database.rows = {
    national_federation_selection_slots: [],
    countries: [
      { id: "nl", iso_alpha2: "NL", name: "Pays-Bas", continent_code: "europe" },
      { id: "ma", iso_alpha2: "MA", name: "Maroc", continent_code: "africa" },
    ],
    races: [], race_editions: [], stages: [], stage_segments: [],
    development_race_editions: [], development_race_stages: [],
    season_days: [{ id: "j15", day_number: 15 }],
  };
});

describe("official federation selection courses", () => {
  it("matches the championship continent even when the host is on another continent, and exposes the stored profile before weather opens", async () => {
    database.rows.national_federation_selection_slots = [slot("cc-road", "continental_championship")];
    proRace("cc-africa", "continental_championship", "africa");
    proRace("cc-europe");
    proRace("ordinary", "standard", null);
    stage("africa-road", "cc-africa", "flat");
    stage("europe-ttt", "cc-europe", "time_trial", "team_time_trial");
    stage("europe-road", "cc-europe", "flat");
    database.rows.stage_segments = [
      { stage_id: "europe-road", segment_number: 1, distance_km: "10", terrain_type: "flat", surface_type: "asphalt", average_gradient_pct: "0" },
      { stage_id: "europe-road", segment_number: 2, distance_km: "10", terrain_type: "climb", surface_type: "asphalt", average_gradient_pct: "5" },
    ];

    const forecast = (await load())["cc-road"];
    expect(forecast.weather).toBeNull();
    expect(forecast.course).toMatchObject({
      stageId: "europe-road", stageType: "road", profileType: "hilly",
      countryCode: "MA", countryName: "Maroc", distanceKm: 20, dayNumber: 15,
      href: "/jeu/courses/cc-europe",
    });
    expect(forecast.course?.segments).toEqual([
      { segmentNumber: 1, distanceKm: 10, terrain: "flat", surface: "asphalt", averageGradientPct: 0, prime: null },
      { segmentNumber: 2, distanceKm: 10, terrain: "climb", surface: "asphalt", averageGradientPct: 5, prime: null },
    ]);
    expect(database.filters).toContainEqual({ table: "race_editions", column: "race_id", values: ["cc-europe"] });
  });

  it("matches all five professional Nations Cup disciplines and uses the calendar fallback seed", async () => {
    const profiles = [
      ["Montagne", "mountain", "road"], ["Vallons", "hilly", "road"],
      ["Sprint", "sprint", "road"], ["Pavés", "cobbles", "road"],
      ["Chrono", "time_trial", "individual_time_trial"],
    ] as const;
    for (const [label, profile, type] of profiles) {
      database.rows.national_federation_selection_slots.push(slot(profile, "nations_cup", label));
      proRace(profile, "nations_cup", null);
      stage(`${profile}-stage`, profile, profile, type);
    }
    const forecasts = await load();
    for (const [, profile, type] of profiles) {
      expect(forecasts[profile].course).toMatchObject({ stageId: `${profile}-stage`, stageType: type });
      expect(forecasts[profile].course?.segments).toEqual(buildRaceSegments({
        distanceKm: 20, profileType: profile, seed: `${profile}-stage`,
      }));
    }
  });

  it("selects junior CC, world and Nations Cup courses without inventing segments", async () => {
    const events = [
      ["cc", "continental_championship_junior", "continental_road", "europe"],
      ["cm", "world_championship_junior", "world_road", null],
      ["nc", "nations_cup_junior", "nations_cup_junior", null],
    ] as const;
    for (const [key, competition, editionType, continent] of events) {
      database.rows.national_federation_selection_slots.push(slot(key, competition, "Route", "junior"));
      database.rows.development_race_editions.push({
        id: key, slug: `${key}-juniors`, country_code: "MA", season_id: "s3",
        competition_type: editionType, championship_continent_code: continent, status: "planned",
      });
      database.rows.development_race_stages.push({
        id: `${key}-stage`, race_edition_id: key, day_number: 22,
        name: `${key} juniors`, profile_type: "hilly", stage_type: "road", distance_km: "132",
      });
    }
    const forecasts = await load();
    for (const [key] of events) {
      expect(forecasts[key].course).toMatchObject({
        stageId: `junior:${key}-stage`, profileType: "hilly", distanceKm: 132,
        dayNumber: 22, countryName: "Maroc", segments: [], href: `/jeu/resultats-juniors/${key}-juniors`,
      });
      expect(forecasts[key].eventDayNumber).toBe(22);
      expect(forecasts[key].revealDayNumber).toBe(19);
    }
  });

  it("does not claim an official course when none matches the selection", async () => {
    database.rows.national_federation_selection_slots = [slot("cc-road", "continental_championship")];
    proRace("cc-africa", "continental_championship", "africa");
    stage("africa-road", "cc-africa");
    const forecast = (await load())["cc-road"];
    expect(forecast.isOfficialCourse).toBe(false);
    expect(forecast.course).toBeNull();
  });

  it("loads later segment pages and keeps database filters within 100 identifiers", async () => {
    database.rows.national_federation_selection_slots = [slot("world-road", "world_championship")];
    proRace("world", "world_championship", null);
    for (let index = 0; index < 101; index += 1) {
      const id = `stage-${String(index).padStart(3, "0")}`;
      stage(id, "world", "flat", index === 99 ? "road" : "individual_time_trial");
      database.rows.stages.at(-1)!.distance_km = 200;
      for (let number = 1; number <= 20; number += 1) {
        database.rows.stage_segments.push({
          stage_id: id, segment_number: number, distance_km: 10,
          terrain_type: "flat", surface_type: "cobbles", average_gradient_pct: 0,
        });
      }
    }
    const course = (await load())["world-road"].course;
    expect(course?.stageId).toBe("stage-099");
    expect(course?.segments).toHaveLength(20);
    expect(course?.segments.every((segment) => segment.surface === "cobbles")).toBe(true);
    expect(database.filters.every((filter) => filter.values.length <= 100)).toBe(true);
  });
});
