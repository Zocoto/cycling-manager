import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";

const mock = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  queries: [] as { table: string; filters: Record<string, string> }[],
  pendingTeam: null as Promise<{ data: unknown; error: { message: string } | null }> | null,
  errors: {} as Record<string, string>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from(table: string) {
    const filters: Record<string, string> = {};
    const finish = () => {
      mock.queries.push({ table, filters });
      if (table === "team_seasons" && mock.pendingTeam) return mock.pendingTeam;
      return Promise.resolve({ data: mock.rows[table] ?? null,
        error: mock.errors[table] ? { message: mock.errors[table] } : null });
    };
    const query = {
      select: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: string) => { filters[key] = value; return query; },
      returns: finish, maybeSingle: finish,
    };
    return query;
  } }),
}));
import { getActiveTeamSponsorIdentity } from "./team-sponsor-identity";

describe("active sponsor identity independent reads", () => {
  const sponsor = SPONSORS[0];
  beforeEach(() => {
    mock.queries = []; mock.pendingTeam = null; mock.errors = {};
    mock.rows = {
      team_sponsor_contracts: [{ id: "contract", sponsor_id: "registry", selected_jersey_id: sponsor.jerseys[0].id,
        budget_per_season: "120000", currency_code: "EUR", contract_duration_seasons: 2, start_season_id: "first" }],
      sponsors: { catalog_key: sponsor.id }, seasons: { id: "active" },
      team_seasons: { display_name: "Mon équipe", short_name: "ME" },
      secondary_sponsor_contracts: { secondary_sponsor_id: "second", logo_x_percent: "40", logo_y_percent: "20", logo_scale: "1.2", logo_rotation_degrees: "-5" },
      secondary_sponsor_catalog: { id: "second", country_id: "country", name: "Secondaire", prestige: 3, primary_color: "#123456", accent_color: "#abcdef", logo_variant: "wordmark" },
      countries: { name: "France", iso_alpha2: "FR" },
    };
  });
  it("starts the secondary lookup while the team name is still loading and preserves the complete identity", async () => {
    let release!: (value: { data: unknown; error: null }) => void;
    mock.pendingTeam = new Promise(resolve => { release = resolve; });
    const identityPromise = getActiveTeamSponsorIdentity(" team ");
    await vi.waitFor(() => expect(mock.queries.some(q => q.table === "countries")).toBe(true));
    release({ data: mock.rows.team_seasons, error: null });
    expect(await identityPromise).toEqual({
      contractId: "contract", teamId: "team", teamName: "Mon équipe", teamShortName: "ME", sponsor,
      selectedJersey: sponsor.jerseys[0], budgetPerSeason: 120000, currencyCode: "EUR", contractDurationSeasons: 2,
      secondarySponsor: { id: "second", name: "Secondaire", countryCode: "FR", countryName: "France", prestige: 3,
        primaryColor: "#123456", accentColor: "#abcdef", logoVariant: "wordmark" },
      secondaryLogoPlacement: { xPercent: 40, yPercent: 20, scale: 1.2, rotationDegrees: -5 },
    });
    expect(mock.queries.filter(q => ["team_seasons", "secondary_sponsor_contracts"].includes(q.table))
      .map(q => q.filters)).toEqual([
        { team_id: "team", season_id: "active" },
        { team_id: "team", season_id: "active", status: "active" },
      ]);
  });
  it("retains the first-season and catalogue fallbacks without a secondary sponsor", async () => {
    mock.rows.seasons = null; mock.rows.team_seasons = null; mock.rows.secondary_sponsor_contracts = null;
    const identity = await getActiveTeamSponsorIdentity("team");
    expect(identity).toMatchObject({ teamName: sponsor.name, teamShortName: sponsor.shortName,
      secondarySponsor: null, secondaryLogoPlacement: null });
    expect(mock.queries.find(q => q.table === "team_seasons")?.filters.season_id).toBe("first");
  });
  it("keeps the team error priority if both independent reads fail", async () => {
    mock.errors.team_seasons = "name unavailable"; mock.errors.secondary_sponsor_contracts = "secondary unavailable";
    await expect(getActiveTeamSponsorIdentity("team")).rejects.toThrow("identité de l’équipe : name unavailable");
  });
  it("propagates a secondary failure instead of silently losing the sponsor", async () => {
    mock.errors.secondary_sponsor_contracts = "unavailable";
    await expect(getActiveTeamSponsorIdentity("team")).rejects.toThrow("sponsor secondaire actif : unavailable");
  });
  it("does not load identity details for an unsigned team", async () => {
    mock.rows.team_sponsor_contracts = [];
    expect(await getActiveTeamSponsorIdentity("team")).toBeNull();
    expect(mock.queries.map(q => q.table)).toEqual(["team_sponsor_contracts"]);
  });
});
