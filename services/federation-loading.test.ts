import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  queriedTables: [] as string[],
}));
const searchDirectory = vi.hoisted(() => vi.fn());
const loadJerseys = vi.hoisted(() => vi.fn(async () => new Map()));
vi.mock("@/services/national-federation-jerseys", () => ({
  loadNationalFederationJerseyDesigns: loadJerseys,
}));

function from(table: string) {
  database.queriedTables.push(table);
  let rows = [...(database.rows[table] ?? [])];
  const query = {
    select() { return query; },
    eq(column: string, value: unknown) {
      rows = rows.filter((row) => row[column] === value);
      return query;
    },
    in(column: string, values: unknown[]) {
      rows = rows.filter((row) => values.includes(row[column]));
      return query;
    },
    lte(column: string, value: number) {
      rows = rows.filter((row) => Number(row[column]) <= value);
      return query;
    },
    gte(column: string, value: number) {
      rows = rows.filter((row) => Number(row[column]) >= value);
      return query;
    },
    order() { return query; },
    async returns() { return { data: rows, error: null }; },
    async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
  };
  return query;
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from }),
}));
vi.mock("@/services/global-search", () => ({
  searchGameDirectory: searchDirectory,
}));

import { getNationalFederationSnapshot } from "./national-federations";
import { getPublicCountryDirectory } from "./public-directory";

const presidentId = "d2541367-b694-4f1f-b585-647119b25dd0";
const countryId = "fr";
const snapshotInput = { countryId, countryCode: "FR", viewerTeamId: "team" };
const client = { from } as unknown as Parameters<typeof getPublicCountryDirectory>[0];

beforeEach(() => {
  database.queriedTables = [];
  searchDirectory.mockReset();
  loadJerseys.mockClear();
  database.rows = {
    seasons: [{ id: "s4", name: "Saison 4", game_year: 4, current_day_number: 8, status: "active" }],
    countries: [{ id: countryId, name: "France", iso_alpha2: "FR", iso_alpha3: "FRA", is_active: true }],
    team_seasons: [{ team_id: "team", season_id: "s4", display_name: "Équipe test", registration_country_id: countryId }],
    rider_national_championship_titles: [{ rider_id: "pro", season_id: "s4", championship_type: "road", won_at: "2026-10-12", relinquished_at: null, country_id: countryId }],
    junior_championship_titles: [{ academy_rider_id: "junior", season_id: "s4", championship_type: "road", won_at: "2026-10-12", country_code: "FR", title_level: "national" }],
    international_youth_centers: [{ team_id: "team", country_id: countryId, quality_level: 2, efficiency_bonus_percentage: 0, completed_at: "2026-10-12" }],
    national_federation_terms: [{ country_id: countryId, start_game_year: 4, end_game_year: 5, governance_mode: "elected", president_director_id: presidentId }],
    national_federation_accounts: [{ country_id: countryId, season_id: "s4", balance: 12345 }],
    sporting_directors: [{ id: presidentId, country_id: countryId, username: "president", display_name: "Président test", status: "active" }],
    riders: [{ id: "pro", first_name: "Champion", last_name: "Pro" }],
    youth_academy_riders: [{ id: "junior", first_name: "Champion", last_name: "Junior", team_id: "team", birth_game_year: -13 }],
    rider_contracts: [{ rider_id: "pro", team_id: "team", status: "active" }],
    rider_season_ratings: [{ rider_id: "pro", season_id: "s4", age: 25 }],
  };
});

describe("targeted federation loading", () => {
  it("preserves the complete overview and default service contract", async () => {
    const snapshot = await getNationalFederationSnapshot(snapshotInput);
    expect(database.queriedTables).toHaveLength(14);
    expect(snapshot.palmares).toHaveLength(2);
    expect(snapshot.champions.professional.road?.riderName).toBe("Champion Pro");
    expect(snapshot.champions.junior.road?.riderName).toBe("Champion Junior");
    expect(snapshot.academies.centers).toHaveLength(1);
    expect(snapshot.viewer.isAffiliated).toBe(true);
  });

  it("saves nine queries on tabs that do not render champions or schools, without caching membership or money", async () => {
    const snapshot = await getNationalFederationSnapshot({ ...snapshotInput, includeChampions: false, includeAcademies: false });
    expect(database.queriedTables).toEqual([
      "seasons", "team_seasons", "national_federation_terms", "national_federation_accounts", "sporting_directors",
    ]);
    expect(snapshot.viewer.isAffiliated).toBe(true);
    expect(snapshot.presidency.presidentName).toBe("Président test");
    expect(snapshot.treasuryBalance).toBe(12345);
    expect(snapshot.season.currentDayNumber).toBe(8);
    database.rows.team_seasons[0].registration_country_id = "de";
    database.rows.national_federation_accounts[0].balance = 42;
    const next = await getNationalFederationSnapshot({ ...snapshotInput, includeChampions: false, includeAcademies: false });
    expect(next.viewer.isAffiliated).toBe(false);
    expect(next.treasuryBalance).toBe(42);
  });

  it("retains schools and their effects on the infrastructures tab without loading champions", async () => {
    const snapshot = await getNationalFederationSnapshot({ ...snapshotInput, includeChampions: false });
    expect(database.queriedTables).toHaveLength(7);
    expect(database.queriedTables).not.toContain("riders");
    expect(database.queriedTables).not.toContain("junior_championship_titles");
    expect(snapshot.academies.centers[0].teamName).toBe("Équipe test");
    expect(snapshot.academies.totalQualityStars).toBe(2);
  });

  it.each(["fr", " FRA "])("loads only one exact country query for %s instead of global directory searches", async (code) => {
    const directory = await getPublicCountryDirectory(client, code, { includeMembers: false, includePresident: false });
    expect(database.queriedTables).toEqual(["countries"]);
    expect(searchDirectory).not.toHaveBeenCalled();
    expect(directory?.country.country_code).toBe("FR");
    expect(directory?.members.teams).toEqual([]);
    expect(directory?.president).toBeNull();
  });

  it("does not expose inactive countries or fall back to fuzzy search for a missing country", async () => {
    database.rows.countries[0].is_active = false;
    expect(await getPublicCountryDirectory(client, "fr", { includeMembers: false, includePresident: false })).toBeNull();
    expect(await getPublicCountryDirectory(client, "France", { includeMembers: false, includePresident: false })).toBeNull();
    expect(database.queriedTables).toEqual(["countries"]);
    expect(searchDirectory).not.toHaveBeenCalled();
  });

  it("retains full country-directory behavior by default for public nation pages", async () => {
    searchDirectory.mockResolvedValue([{ result_type: "country", entity_id: countryId, public_identifier: "fr", country_code: "FR" }]);
    const directory = await getPublicCountryDirectory(client, "fr");
    expect(searchDirectory).toHaveBeenCalledWith(client, "fr", 20);
    expect(directory?.president?.display_name).toBe("Président test");
  });

  it("wires the lazy sections only after authenticating and retains the foreign-federation access check", () => {
    const page = readFileSync(join(process.cwd(), "app/jeu/federations/[codePays]/page.tsx"), "utf8");
    expect(page).toContain("includeMembers: needsMemberDirectory");
    expect(page).toContain("includePresident: false");
    expect(page).toContain('includeChampions: selectedTab === "overview"');
    expect(page).toContain('selectedTab === "overview" || selectedTab === "infrastructures"');
    expect(page.indexOf('if (authenticationError || !user) redirect("/connexion")')).toBeLessThan(page.indexOf("getPublicCountryDirectory(supabase"));
    expect(page.indexOf("canAccessNationalFederationManagement(\n")).toBeLessThan(page.indexOf("getNationalFederationSnapshot({"));
  });
});
