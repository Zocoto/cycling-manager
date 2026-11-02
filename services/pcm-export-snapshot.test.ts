import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  titleError: false,
  titleCalls: [] as { method: string; args: unknown[] }[],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      let data = [...(state.tables[table] ?? [])];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { data = data.filter(r => r[column] === value); return query; },
        in: (column: string, values: unknown[]) => {
          if (table === "rider_national_championship_titles") state.titleCalls.push({ method: "in", args: [column, values] });
          data = data.filter(r => values.includes(r[column])); return query;
        },
        is: (column: string, value: unknown) => {
          if (table === "rider_national_championship_titles") state.titleCalls.push({ method: "is", args: [column, value] });
          data = data.filter(r => r[column] === value); return query;
        },
        order: () => query,
        range: (from: number, to: number) => { data = data.slice(from, to + 1); return query; },
        returns: () => Promise.resolve({ data, error: table === "rider_national_championship_titles" && state.titleError ? { message: "title query unavailable" } : null }),
        abortSignal: () => Promise.resolve({ data, error: null }),
        single: () => Promise.resolve({ data: data[0], error: null }),
      };
      return query;
    },
  }),
}));

import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";

beforeEach(() => {
  state.titleError = false; state.titleCalls = [];
  state.tables = {
    seasons: [{ id: "s3", game_year: 3, status: "active" }],
    team_seasons: [{ id: "ts", team_id: "t1", season_id: "s3", status: "active", division_id: "div", display_name: "Team", registration_country_id: "np" }],
    teams: [{ id: "t1", home_country_id: "np", pcm_export_id: 244, pcm_asset_code: "apt" }],
    countries: [{ id: "np", iso_alpha2: "NP", iso_alpha3: "NPL", name: "Népal", continent_code: "asia" }],
    divisions: [{ id: "div", code: "world" }],
    rider_contracts: [{ id: "contract", rider_id: "r1", team_id: "t1", start_season_id: "s3", end_season_id: "s3", status: "active" }],
    riders: [{ id: "r1", pcm_export_id: 10001, first_name: "Roger", last_name: "Test", country_id: "np" }],
    rider_season_ratings: [{ id: "rating", rider_id: "r1", season_id: "s3", age: 25, mountain: 70, hills: 70, flat: 70, time_trial: 70, cobbles: 70, sprint: 70, acceleration: 70, downhill: 70, endurance: 70, resistance: 70, recovery: 70, breakaway: 70, prologue: 70 }],
    rider_national_championship_titles: [
      { rider_id: "r1", country_id: "np", championship_type: "road", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "time_trial", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "road", relinquished_at: "2026-10-01" },
      { rider_id: "r1", country_id: "np", championship_type: "world_road", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "world_time_trial", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "continental_europe_road", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "continental_europe_time_trial", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "continental_africa_road", relinquished_at: null },
      { rider_id: "r1", country_id: "np", championship_type: "quadrennial_road", relinquished_at: null },
      { rider_id: "other", country_id: "np", championship_type: "road", relinquished_at: null },
    ],
  };
});

describe("snapshot des titres PCM", () => {
  it('pins a private gala database to S4 with native ratings after S5 activation',async()=>{
    state.tables.seasons=[{id:'s3',game_year:4,status:'completed'},{id:'s5',game_year:5,status:'active'}];
    state.tables.team_seasons[0].status='completed';state.tables.rider_contracts[0].status='completed';
    const snapshot=await createPcmExportSnapshot(false,true);
    expect(snapshot.activeSeason.game_year).toBe(4);expect(snapshot.galaEdition).toBe('season-four');
    expect(snapshot.ratingPolicy.bonusesIncluded).toBe(false);expect(snapshot.riders).toHaveLength(1);
  });
  it("charge les titres nationaux et mondiaux route actifs des coureurs exportés", async () => {
    const snapshot = await createPcmExportSnapshot();
    expect(snapshot.nationalChampionshipTitles).toHaveLength(6);
    expect(state.titleCalls).toContainEqual({ method: "is", args: ["relinquished_at", null] });
    expect(state.titleCalls).toContainEqual({ method: "in", args: ["rider_id", ["r1"]] });
    expect(state.titleCalls).toContainEqual({ method: "in", args: ["championship_type", ["road", "time_trial", "world_road", "world_time_trial", "continental_europe_road", "continental_europe_time_trial"]] });
    const firstHash = snapshot.sha256;
    state.tables.rider_national_championship_titles = [];
    expect((await createPcmExportSnapshot()).sha256).not.toBe(firstHash);
  });
  it("interrompt l'export si les titres ne peuvent pas être chargés", async () => {
    state.titleError = true;
    await expect(createPcmExportSnapshot()).rejects.toThrow("Impossible de charger les titres nationaux");
  });
  it('restores registered clubs in the S4 export only while leaving current contracts untouched',async()=>{
    state.tables.seasons[0].game_year=4;
    state.tables.teams.push({id:'t2',home_country_id:'np',pcm_export_id:245,pcm_asset_code:'zzz'});
    state.tables.team_seasons.push({...state.tables.team_seasons[0],id:'ts2',team_id:'t2'});
    state.tables.rider_contracts[0].team_id='t2';
    state.tables.season_gala_registrations=[{id:'reg',season_id:'s3',team_id:'t1',program:'continental'}];
    state.tables.season_gala_registration_riders=[{registration_id:'reg',rider_id:'r1'}];
    const gala=await createPcmExportSnapshot(false,true);
    expect(gala.contracts[0].team_id).toBe('t1');
    expect(state.tables.rider_contracts[0].team_id).toBe('t2');
    expect((await createPcmExportSnapshot()).contracts[0].team_id).toBe('t2');
  });
});
