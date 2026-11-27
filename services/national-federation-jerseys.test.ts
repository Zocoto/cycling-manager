import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_MAURITIUS_SELECTION as selection, PREVIEW_MAURITIUS_CHAMPION as champion } from "@/lib/game/federation-jersey-preview-fixtures";

const database = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, queries: [] as string[] }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from }) }));
function from(table: string) {
  database.queries.push(table);
  let rows = [...(database.rows[table] ?? [])];
  const q = {
    select() { return q; }, eq(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return q; },
    in(key: string, values: unknown[]) { rows = rows.filter(r => values.includes(r[key])); return q; },
    is(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return q; },
    not(key: string, _operator: string, value: unknown) { rows = rows.filter(r => r[key] !== value); return q; },
    range(start: number, end: number) { rows = rows.slice(start, end + 1); return q; },
    async returns() { return { data: rows, error: null }; },
    async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
  };
  return q;
}
import { getNationalFederationJersey, loadNationalFederationJerseyDesigns, loadNationalFederationJerseyDesignsByCountryCode } from "./national-federation-jerseys";
import { getActiveChampionshipTitlesForRiders } from "./rider-championship-titles";
import { getActiveNationalChampionshipTitlesByDisciplineForRiders } from "./rider-national-championship-titles";
import { getActiveContinentalChampionshipTitlesByDisciplineForRiders } from "./rider-continental-championship-titles";
const client = { from } as unknown as Parameters<typeof getNationalFederationJersey>[0];

beforeEach(() => {
  database.queries = [];
  const row = { country_id: "mu", country: { iso_alpha2: "MU" }, version: 1, published_at: "2026-10-17T08:00:00Z", active_from_game_year: 4,
    pending_design: { ...selection, baseColor: "#FF00FF" }, pending_version: 2, pending_published_at: "2026-10-17T09:00:00Z", pending_activation_game_year: 5 };
  database.rows = {
    national_federation_jerseys: [{ ...row, design: selection }],
    national_federation_champion_jerseys: [{ ...row, design: champion }],
    countries: [{ id: "mu", name: "Maurice", iso_alpha2: "MU" }],
    rider_national_championship_titles: [
      { rider_id: "champion", country_id: "mu", championship_type: "time_trial", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "champion", country_id: "mu", championship_type: "road", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "former", country_id: "mu", championship_type: "road", relinquished_at: "2026-10-16", rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "world", country_id: null, championship_type: "world_road", relinquished_at: null },
    ],
  };
});

describe("independent national team and champion jerseys", () => {
  it("loads Games champions through the same bounded query, separately from world titles", async () => {
    database.rows.rider_national_championship_titles.push(
      { rider_id: "games", country_id: "mu", championship_type: "quadrennial_time_trial", relinquished_at: null },
      { rider_id: "games", country_id: "mu", championship_type: "quadrennial_road", relinquished_at: null },
      { rider_id: "former-games", country_id: "mu", championship_type: "quadrennial_road", relinquished_at: "2026-10-22" },
    );
    const titles = await getActiveChampionshipTitlesForRiders(client, ["games", "former-games", "world"]);
    expect(titles.quadrennial.get("games")).toMatchObject({ championshipType: "road" });
    expect(titles.quadrennial.has("former-games")).toBe(false);
    expect(titles.world.has("games")).toBe(false);
    expect(titles.world.has("world")).toBe(true);
    expect(database.queries.filter(table => table === "rider_national_championship_titles")).toHaveLength(1);
    expect(database.queries).not.toContain("countries");
  });
  it("uses selection by default and never substitutes the pending next-season design", async () => {
    expect((await loadNationalFederationJerseyDesigns(["mu"])).get("mu")).toEqual(selection);
    expect(database.queries).toEqual(["national_federation_jerseys"]);
  });
  it("loads champion artwork separately, including ISO-indexed junior/fast RPC titles", async () => {
    expect((await loadNationalFederationJerseyDesigns(["mu"], "national_champion")).get("mu")).toEqual(champion);
    expect((await loadNationalFederationJerseyDesignsByCountryCode([" mu "], "national_champion")).get("MU")).toEqual(champion);
    expect(database.queries).not.toContain("national_federation_jerseys");
  });
  it("exposes the pending composition only to the management editor", async () => {
    const pending = await getNationalFederationJersey(client, "mu", "national_champion");
    expect(pending).toMatchObject({ isActive: false, activationGameYear: 5, design: { baseColor: "#FF00FF" } });
    expect((await loadNationalFederationJerseyDesigns(["mu"], "national_champion")).get("mu")).toEqual(champion);
  });
  it("keeps unpublished and unknown countries on the fallback and does not read for empty requests", async () => {
    await loadNationalFederationJerseyDesigns([]); await loadNationalFederationJerseyDesignsByCountryCode([]);
    expect(database.queries).toEqual([]);
    database.rows.national_federation_jerseys[0].active_from_game_year = null;
    expect(await loadNationalFederationJerseyDesigns(["mu"])).toEqual(new Map());
    expect(await loadNationalFederationJerseyDesignsByCountryCode(["FR"])).toEqual(new Map());
  });
  it("enriches national titles with champion, not selection artwork; preserves road priority and world titles", async () => {
    const titles = await getActiveChampionshipTitlesForRiders(client, ["champion", "former", "world"]);
    expect(titles.national.get("champion")).toMatchObject({ championshipType: "road", nationalDesign: champion });
    expect(titles.national.has("former")).toBe(false);
    expect(titles.world.get("world")).toMatchObject({ countryName: "Monde", championshipType: "road" });
    expect(database.queries.filter(t => t === "national_federation_champion_jerseys")).toHaveLength(1);
  });
  it("preserves both disciplines using the same champion design", async () => {
    const titles = (await getActiveNationalChampionshipTitlesByDisciplineForRiders(client, ["champion"])).get("champion");
    expect(titles?.road?.nationalDesign).toEqual(champion);
    expect(titles?.time_trial?.nationalDesign).toEqual(champion);
  });

  it("drops incompatible current jerseys while preserving world, Games, and same-continent titles", async () => {
    database.rows.rider_national_championship_titles = [
      { rider_id: "moved", country_id: "am", championship_type: "road", relinquished_at: "2026-10-16", rider: { country_id: "co", country: { continent_code: "america" } } },
      { rider_id: "moved", country_id: "am", championship_type: "time_trial", relinquished_at: null, rider: { country_id: "co", country: { continent_code: "america" } } },
      { rider_id: "moved", country_id: "am", championship_type: "continental_asia_road", relinquished_at: null, rider: { country_id: "co", country: { continent_code: "america" } } },
      { rider_id: "moved", country_id: "am", championship_type: "continental_asia_time_trial", relinquished_at: null, rider: { country_id: "co", country: { continent_code: "america" } } },
      { rider_id: "same-continent", country_id: "mu", championship_type: "continental_africa_time_trial", relinquished_at: null, rider: { country_id: "za", country: { continent_code: "africa" } } },
      { rider_id: "former-continent", country_id: "mu", championship_type: "continental_africa_road", relinquished_at: "2026-10-16", rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "world", country_id: "am", championship_type: "world_road", relinquished_at: null, rider: { country_id: "co", country: { continent_code: "america" } } },
      { rider_id: "games", country_id: "am", championship_type: "quadrennial_road", relinquished_at: null, rider: { country_id: "co", country: { continent_code: "america" } } },
    ];
    const history = structuredClone(database.rows.rider_national_championship_titles);
    const titles = await getActiveChampionshipTitlesForRiders(client, ["moved", "same-continent", "former-continent", "world", "games"]);

    expect(titles.national.size).toBe(0);
    expect(titles.continental.has("moved")).toBe(false);
    expect(titles.continental.has("former-continent")).toBe(false);
    expect(titles.continental.get("same-continent")).toMatchObject({ continentCode: "africa", championshipType: "time_trial" });
    expect(titles.world.has("world")).toBe(true);
    expect(titles.quadrennial.has("games")).toBe(true);
    expect(database.rows.rider_national_championship_titles).toEqual(history);
    expect(database.queries).toEqual(["rider_national_championship_titles"]);
  });

  it("applies nationality protection in the legacy discipline loaders and retains a valid fallback discipline", async () => {
    database.rows.rider_national_championship_titles = [
      { rider_id: "champion", country_id: "am", championship_type: "road", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "champion", country_id: "mu", championship_type: "time_trial", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "champion", country_id: "am", championship_type: "continental_asia_road", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
      { rider_id: "champion", country_id: "mu", championship_type: "continental_africa_time_trial", relinquished_at: null, rider: { country_id: "mu", country: { continent_code: "africa" } } },
    ];

    const national = await getActiveNationalChampionshipTitlesByDisciplineForRiders(client, ["champion"]);
    const continental = await getActiveContinentalChampionshipTitlesByDisciplineForRiders(client, ["champion"]);
    const combined = await getActiveChampionshipTitlesForRiders(client, ["champion"]);

    expect(national.get("champion")?.road).toBeUndefined();
    expect(national.get("champion")?.time_trial).toMatchObject({ countryCode: "MU", championshipType: "time_trial", nationalDesign: champion });
    expect(continental.get("champion")).toEqual({ time_trial: { riderId: "champion", continentCode: "africa", continentName: "Afrique", championshipType: "time_trial" } });
    expect(combined.national.get("champion")?.championshipType).toBe("time_trial");
    expect(combined.continental.get("champion")?.championshipType).toBe("time_trial");
    expect(database.queries.filter(table => table === "rider_national_championship_titles")).toHaveLength(3);
    expect(database.queries).not.toContain("riders");
  });

  it("falls back to the regular jersey when current nationality cannot be resolved", async () => {
    database.rows.rider_national_championship_titles = [
      { rider_id: "unknown", country_id: "mu", championship_type: "road", relinquished_at: null, rider: null },
      { rider_id: "unknown", country_id: "mu", championship_type: "continental_africa_road", relinquished_at: null, rider: { country_id: "mu", country: null } },
    ];
    const titles = await getActiveChampionshipTitlesForRiders(client, ["unknown"]);
    expect(titles.national.size).toBe(0);
    expect(titles.continental.size).toBe(0);
    expect(database.queries).toEqual(["rider_national_championship_titles"]);
  });
});
