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
      { rider_id: "other", country_id: "np", championship_type: "road", relinquished_at: null },
    ],
  };
});

describe("snapshot des titres nationaux PCM", () => {
  it("charge seulement les titres nationaux actifs des coureurs exportés", async () => {
    const snapshot = await createPcmExportSnapshot();
    expect(snapshot.nationalChampionshipTitles).toHaveLength(2);
    expect(state.titleCalls).toContainEqual({ method: "is", args: ["relinquished_at", null] });
    expect(state.titleCalls).toContainEqual({ method: "in", args: ["rider_id", ["r1"]] });
    expect(state.titleCalls).toContainEqual({ method: "in", args: ["championship_type", ["road", "time_trial"]] });
    const firstHash = snapshot.sha256;
    state.tables.rider_national_championship_titles = [];
    expect((await createPcmExportSnapshot()).sha256).not.toBe(firstHash);
  });
  it("interrompt l'export si les titres ne peuvent pas être chargés", async () => {
    state.titleError = true;
    await expect(createPcmExportSnapshot()).rejects.toThrow("Impossible de charger les titres nationaux");
  });
});
