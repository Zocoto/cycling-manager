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
    range(start: number, end: number) { rows = rows.slice(start, end + 1); return q; },
    async returns() { return { data: rows, error: null }; },
    async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
  };
  return q;
}
import { getNationalFederationJersey, loadNationalFederationJerseyDesigns, loadNationalFederationJerseyDesignsByCountryCode } from "./national-federation-jerseys";
import { getActiveChampionshipTitlesForRiders } from "./rider-championship-titles";
import { getActiveNationalChampionshipTitlesByDisciplineForRiders } from "./rider-national-championship-titles";
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
      { rider_id: "champion", country_id: "mu", championship_type: "time_trial", relinquished_at: null },
      { rider_id: "champion", country_id: "mu", championship_type: "road", relinquished_at: null },
      { rider_id: "former", country_id: "mu", championship_type: "road", relinquished_at: "2026-10-16" },
      { rider_id: "world", country_id: null, championship_type: "world_road", relinquished_at: null },
    ],
  };
});

describe("independent national team and champion jerseys", () => {
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
});
