import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";

const mock = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mock.createAdmin }));
import { getSecondarySponsoringStateForAuthUser } from "./secondary-sponsors";
import { getActiveTeamSponsorIdentity } from "./team-sponsor-identity";

type Row = Record<string, unknown>;
const sponsor = SPONSORS.find(candidate => candidate.id === "ardennes-outillage")!;

function fixture() {
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active", reputation_points: 3_000 }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active" }],
    teams: [{ id: "team", home_country_id: "be" }],
    seasons: [
      { id: "s5", game_year: 5, name: "Saison 5", status: "active", current_day_number: 22 },
      { id: "s6", game_year: 6, name: "Saison 6", status: "planned", current_day_number: 1 },
      { id: "s7", game_year: 7, name: "Saison 7", status: "planned", current_day_number: 1 },
    ],
    countries: [{ id: "be", name: "Belgique", iso_alpha2: "BE" }],
    sponsors: [{ id: "primary", catalog_key: sponsor.id }],
    team_seasons: [{ team_id: "team", season_id: "s5", display_name: "Current team", short_name: "CUR" }],
    team_sponsor_contracts: [{ id: "primary-contract", team_id: "team", role: "principal", sponsor_id: "primary", status: "active", start_season_id: "s5", end_season_id: null, contract_duration_seasons: 2,
      selected_jersey_id: sponsor.jerseys[0].id, pending_jersey_id: sponsor.jerseys[1].id, pending_jersey_season_id: "s6", budget_per_season: 200_000, currency_code: "EUR" }],
    secondary_sponsor_catalog: [{ id: "secondary", country_id: "be", name: "Partner", prestige: 3, primary_color: "#123456", accent_color: "#ABCDEF", logo_variant: "wordmark" }],
    secondary_sponsor_contracts: ["s5", "s6"].map(season => ({ id: `secondary-${season}`, team_id: "team", season_id: season, offer_id: `offer-${season}`, secondary_sponsor_id: "secondary", status: season === "s5" ? "active" : "planned", logo_x_percent: 50, logo_y_percent: 48, logo_scale: 1, logo_rotation_degrees: 0, logo_color_mode: "white" })),
    secondary_sponsor_objectives: [],
  };
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let maximum = Infinity;
    const finish = (single = false) => {
      queries.push({ table, filters: [...filters] });
      const rows = (tables[table] ?? []).filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)).slice(0, maximum);
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null });
    };
    const query = {
      select: () => query, order: () => query, range: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      in: (key: string, values: unknown[]) => { filters.push([key, values]); return query; },
      limit: (count: number) => { maximum = count; return query; },
      maybeSingle: () => finish(true), returns: () => finish(),
      then: (resolve: (value: unknown) => unknown) => finish().then(resolve),
    };
    return query;
  };
  mock.createAdmin.mockReturnValue({ from });
  return { tables, queries };
}

beforeEach(() => vi.clearAllMocks());

describe("signed secondary sponsors use the principal jersey of their own season", () => {
  it("keeps the active jersey and the next-season preview independent", async () => {
    const f = fixture();
    const before = structuredClone(f.tables);
    const state = await getSecondarySponsoringStateForAuthUser("user");
    if (state?.kind !== "signed") throw Error("Expected signed sponsor");
    expect(state.activeContract?.baseJersey?.jersey.id).toBe(sponsor.jerseys[0].id);
    expect(state.contract.baseJersey?.jersey.id).toBe(sponsor.jerseys[1].id);
    expect(state.contract.targetSeasonName).toBe("Saison 6");
    expect(f.tables).toEqual(before);
    expect(f.queries.some(query => query.table === "race_editions")).toBe(false);
  });
  it.each([null, "s5", "s7"])("waits for an explicit S6 choice when the pending season is %s", async pending => {
    const f = fixture();
    f.tables.team_sponsor_contracts[0].pending_jersey_season_id = pending;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    if (state?.kind !== "signed") throw Error("Expected signed sponsor");
    expect(state.contract.baseJersey).toBeNull();
    expect(state.contract.principalCountryCode).toBe(sponsor.countryCode);
    expect(state.contract.principalTeamName).toBe(sponsor.name);
    expect(state.activeContract?.baseJersey?.jersey.id).toBe(sponsor.jerseys[0].id);
  });
  it("uses a newly signed S6 sponsor's jersey before the current S5 contract", async () => {
    const f = fixture();
    const nextSponsor = SPONSORS.find(candidate => candidate.id !== sponsor.id)!;
    f.tables.sponsors.push({ id: "next-primary", catalog_key: nextSponsor.id });
    f.tables.team_sponsor_contracts.unshift({ id: "next-primary-contract", team_id: "team", role: "principal", sponsor_id: "next-primary", status: "planned", start_season_id: "s6", end_season_id: null, contract_duration_seasons: 1, selected_jersey_id: nextSponsor.jerseys[0].id, pending_jersey_id: null, pending_jersey_season_id: null });
    const state = await getSecondarySponsoringStateForAuthUser("user");
    if (state?.kind !== "signed") throw Error("Expected signed sponsor");
    expect(state.contract.baseJersey?.sponsor.id).toBe(nextSponsor.id);
    expect(state.contract.baseJersey?.jersey.id).toBe(nextSponsor.jerseys[0].id);
    expect(state.activeContract?.baseJersey?.sponsor.id).toBe(sponsor.id);
  });
  it("does not fall back to S5 if the signed S6 contract has no chosen jersey", async () => {
    const f = fixture();
    f.tables.team_sponsor_contracts.unshift({ ...f.tables.team_sponsor_contracts[0], status: "planned", start_season_id: "s6", selected_jersey_id: null });
    const state = await getSecondarySponsoringStateForAuthUser("user");
    if (state?.kind !== "signed") throw Error("Expected signed sponsor");
    expect(state.contract.baseJersey).toBeNull();
    expect(state.activeContract?.baseJersey?.jersey.id).toBe(sponsor.jerseys[0].id);
  });
  it("keeps the worn jersey and the logo placement on the current season's active contract", async () => {
    const f = fixture();
    f.tables.secondary_sponsor_contracts[0].logo_color_mode = "black";
    const identity = await getActiveTeamSponsorIdentity("team");
    expect(identity?.selectedJersey.id).toBe(sponsor.jerseys[0].id);
    expect(identity?.secondaryLogoPlacement?.colorMode).toBe("black");
    expect(identity?.teamName).toBe("Current team");
  });
  it("does not display the future secondary logo on current riders before activation", async () => {
    const f = fixture();
    f.tables.secondary_sponsor_contracts = f.tables.secondary_sponsor_contracts.filter(contract => contract.status === "planned");
    const identity = await getActiveTeamSponsorIdentity("team");
    expect(identity?.selectedJersey.id).toBe(sponsor.jerseys[0].id);
    expect(identity?.secondarySponsor).toBeNull();
    expect(identity?.secondaryLogoPlacement).toBeNull();
  });
});
