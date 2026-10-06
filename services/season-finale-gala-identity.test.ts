import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
import { CS_RATING_KEYS } from "@/lib/game/pcm-export/ratings";
import { applySeasonFinaleGalaIdentities, getSeasonFinaleGalaJersey, loadSeasonFinaleGalaIdentities, type SeasonFinaleGalaIdentity } from "./season-finale-gala-identity";

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mock }));
import { createPcmExportSnapshot } from "./pcm-export-snapshot";

const identity: SeasonFinaleGalaIdentity = { team_id: "team", identity_season: 4,
  team_name: "Future principale - Secondaire", team_short_name: "FUT-SEC", team_country_code: "it",
  registration_country_id: "it", sponsor_catalog_key: SPONSORS[0].id,
  jersey_id: SPONSORS[0].jerseys[0].id, jersey_style: SPONSORS[0].jerseys[0].style, identity_ready: true };
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
beforeEach(() => {
  tables = {
    seasons: [{ id: "s3", game_year: 3, status: "completed" }, { id: "s4", game_year: 4, status: "active" }],
    team_seasons: [{ id: "ts3", season_id: "s3", team_id: "team", division_id: null, registration_country_id: "fr", display_name: "Ancienne équipe", short_name: "OLD", status: "completed", operating_budget: 0, final_rank: 1 },
      { id: "ts4", season_id: "s4", team_id: "team", division_id: null, registration_country_id: "it", display_name: "Équipe actuellement active S4", short_name: "ACT", status: "active", operating_budget: 0, final_rank: null }],
    teams: [{ id: "team", home_country_id: "fr", pcm_export_id: 244, pcm_asset_code: "abc", amateur_jersey_primary_color: "#111111", amateur_jersey_secondary_color: "#ffffff" }],
    countries: [], divisions: [],
    rider_contracts: [{ id: "c3", rider_id: "rider", team_id: "team", start_season_id: "s3", end_season_id: "s3", salary_per_season: 0, status: "completed" },
      { id: "c4", rider_id: "rider", team_id: "team", start_season_id: "s4", end_season_id: "s4", salary_per_season: 0, status: "active" }],
    riders: [{ id: "rider", pcm_export_id: 10001, first_name: "Gala", last_name: "Test", country_id: "fr", height_cm: 180, weight_kg: 70, potential_steps: 3 }],
    rider_season_ratings: [3, 4].map((season) => ({ id: `ratings${season}`, rider_id: "rider", season_id: `s${season}`, age: 25, ...Object.fromEntries(CS_RATING_KEYS.map((key) => [key, season === 3 ? 70 : 71])) })),
    rider_national_championship_titles: [{ id: "title", rider_id: "rider", country_id: "fr", championship_type: "road", relinquished_at: null }],
  };
  mock.rpc.mockReset();
  mock.rpc.mockImplementation((name: string, params?: { p_team_ids?: string[] }) => Promise.resolve({ data:
    name === "get_season_finale_gala_export_context" ? [{ id: "s3", game_year: 3 }]
      : (params?.p_team_ids ?? []).map((team_id) => ({ ...identity, team_id })), error: null }));
  mock.from.mockReset();
  mock.from.mockImplementation((table: string) => {
    let rows = [...tables[table]];
    let bounds: [number, number] | null = null;
    const query = { select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return query; },
      is: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      order: () => query,
      single: async () => ({ data: rows[0], error: null }),
      range: (from: number, to: number) => { bounds = [from, to]; return query; },
      returns: () => query,
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({
        data: bounds ? rows.slice(bounds[0], bounds[1] + 1) : rows, error: null,
      }).then(resolve),
    };
    return query;
  });
});

describe("identités du gala, données simulées uniquement", () => {
  it("ne change pas l'export ordinaire de la saison active", async () => {
    const snapshot = await createPcmExportSnapshot();
    expect(snapshot.activeSeason.game_year).toBe(4);
    expect(snapshot.teamSeasons[0].display_name).toBe("Équipe actuellement active S4");
    expect(snapshot.contracts.map((row) => row.id)).toEqual(["c4"]);
    expect(snapshot.ratings[0].hills).toBe(71);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("exporte les noms S4 avec les effectifs et notes S3, même après le rollover", async () => {
    const original = structuredClone(tables);
    const snapshot = await createPcmExportSnapshot(true);
    expect(snapshot.activeSeason.game_year).toBe(3);
    expect(snapshot.teamSeasons[0]).toMatchObject({ display_name: identity.team_name, short_name: "FUT-SEC", registration_country_id: "it" });
    expect(snapshot.contracts.map((row) => row.id)).toEqual(["c3"]);
    expect(snapshot.ratings[0].hills).toBe(70);
    expect(snapshot.nationalChampionshipTitles).toMatchObject([{ rider_id: "rider", country_id: "fr", championship_type: "road" }]);
    expect(snapshot.teams[0].amateur_jersey_primary_color).toBe(SPONSORS[0].colors.primary);
    expect(tables).toEqual(original);
  });
  it("projette une copie sans modifier les noms, notes ou contrats du snapshot source", async () => {
    const snapshot = await createPcmExportSnapshot();
    const original = structuredClone(snapshot);
    const projected = applySeasonFinaleGalaIdentities(snapshot, new Map([["team", identity]]));
    expect(snapshot).toEqual(original);
    expect(projected.contracts).toBe(snapshot.contracts);
    expect(projected.ratings).toBe(snapshot.ratings);
    expect(projected.nationalChampionshipTitles).toBe(snapshot.nationalChampionshipTitles);
    expect(projected.teamSeasons[0].display_name).toBe(identity.team_name);
    expect(getSeasonFinaleGalaJersey(identity)).not.toBeNull();
    expect(getSeasonFinaleGalaJersey({ ...identity, sponsor_catalog_key: null })).toBeNull();
  });
  it("charge les identités par lots bornés et remonte les erreurs", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `team-${index}`);
    const result = await loadSeasonFinaleGalaIdentities(mock as never, ids);
    expect(result.size).toBe(205);
    expect(mock.rpc.mock.calls.map(([, params]) => params.p_team_ids.length)).toEqual([100, 100, 5]);
    mock.rpc.mockResolvedValue({ data: null, error: { message: "indisponible" } });
    await expect(loadSeasonFinaleGalaIdentities(mock as never, ["team"])).rejects.toThrow("Impossible de charger les identités du gala");
  });
});
