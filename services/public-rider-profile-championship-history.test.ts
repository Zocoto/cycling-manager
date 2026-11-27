import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadNationalFederationJerseyDesigns } from "@/services/national-federation-jerseys";
import { getPublicRiderProfile } from "@/services/public-rider-profile";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/services/archived-rider-profile", () => ({
  getArchivedRiderProfile: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/services/national-federation-jerseys", () => ({
  loadNationalFederationJerseyDesigns: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/services/rider-development-history", () => ({
  getRiderDevelopmentHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/services/scouting-visibility", () => ({
  getViewerScoutingVisibility: vi.fn().mockResolvedValue({
    active: false, activeUntil: null, dataRoomLevel: 0,
  }),
}));

const riderId = "00000000-0000-4000-8000-000000000001";
const armenia = { id: "armenia", name: "Arménie", iso_alpha2: "AM" };
const colombia = {
  id: "colombia", name: "Colombie", iso_alpha2: "CO", continent_code: "america",
};

function title(
  championshipType: string,
  country = armenia,
  seasonId = "season-2",
  relinquishedAt: string | null = null,
) {
  return {
    country_id: country.id,
    country,
    season_id: seasonId,
    race_edition_id: `${seasonId}-${country.id}-${championshipType}`,
    championship_type: championshipType,
    won_at: seasonId === "season-1" ? "2026-04-01T10:00:00Z" : "2026-10-01T10:00:00Z",
    relinquished_at: relinquishedAt,
  };
}

function profileClient(titles: Array<ReturnType<typeof title>>) {
  const rows: Record<string, unknown> = {
    riders: {
      id: riderId, country_id: colombia.id, first_name: "Gocha", last_name: "Vashadze",
      status: "active", avatar_profile_key: "default", avatar_seed: 1,
      potential_steps: 4, career_race_days: 10, height_cm: null, weight_kg: null,
      baseline_weight_kg: null, physiology_version: null,
    },
    countries: colombia,
    seasons: [
      { id: "season-2", game_year: 2027, name: "Saison 2", status: "active", current_day_number: 10 },
      { id: "season-1", game_year: 2026, name: "Saison 1", status: "completed", current_day_number: 90 },
    ],
    rider_season_ratings: [],
    rider_contracts: [{
      team_id: "team", start_season_id: "season-1", end_season_id: "season-2",
      salary_per_season: 100, currency_code: "EUR", status: "completed",
      signed_at: null, joined_day_number: 1, left_season_id: null,
      left_day_number: null, transfer_fee: null, squad_status: null,
    }],
    rider_season_summaries: [],
    rider_equipment_assignments: [],
    rider_special_abilities: [],
    rider_injuries: null,
    transfer_market_listings: null,
    rider_national_championship_titles: titles,
    reward_events: [],
    season_days: [],
    teams: [{ id: "team", internal_name: "Cyclo", amateur_name: null }],
    team_seasons: [],
  };
  const queries = new Map<string, ReturnType<typeof query>>();
  function query(table: string) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: rows[table], error: null }),
      returns: vi.fn().mockResolvedValue({ data: rows[table], error: null }),
    };
  }
  const from = vi.fn((table: string) => {
    if (!(table in rows)) throw new Error(`Unexpected profile query: ${table}`);
    const result = query(table);
    queries.set(table, result);
    return result;
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createSupabaseAdminClient>,
  );
  return { from, queries };
}

async function loadProfile() {
  return getPublicRiderProfile({ riderIdentifier: riderId, viewerAuthUserId: "" });
}

beforeEach(() => vi.clearAllMocks());

describe("public rider championship history after naturalization", () => {
  it("keeps Armenian titles in their original seasons, including relinquished titles", async () => {
    const titles = [
      title("road"),
      title("time_trial", armenia, "season-1", "2026-10-01T10:00:00Z"),
      title("road", colombia),
    ];
    const originalTitles = structuredClone(titles);
    const { from, queries } = profileClient(titles);

    const profile = await loadProfile();

    expect(profile?.country.code).toBe("CO");
    expect(profile?.nationalTitles).toMatchObject([
      { type: "road", seasonId: "season-2", seasonName: "Saison 2", countryName: "Arménie", countryCode: "AM", isActive: false },
      { type: "time_trial", seasonId: "season-1", seasonName: "Saison 1", countryName: "Arménie", countryCode: "AM", isActive: false },
      { type: "road", seasonId: "season-2", seasonName: "Saison 2", countryName: "Colombie", countryCode: "CO", isActive: true },
    ]);
    expect(profile?.history.map((entry) => ({
      seasonId: entry.seasonId, nationalTitles: entry.nationalTitles,
    }))).toEqual([
      { seasonId: "season-2", nationalTitles: [
        { type: "road", countryName: "Arménie", countryCode: "AM" },
        { type: "road", countryName: "Colombie", countryCode: "CO" },
      ] },
      { seasonId: "season-1", nationalTitles: [
        { type: "time_trial", countryName: "Arménie", countryCode: "AM" },
      ] },
    ]);
    expect(titles).toEqual(originalTitles);
    expect(from.mock.calls.filter(([table]) => table === "countries")).toHaveLength(1);
    expect(queries.get("rider_national_championship_titles")?.select).toHaveBeenCalledWith(
      expect.stringContaining("country:countries!rider_national_championship_titles_country_id_fkey(id, name, iso_alpha2)"),
    );
    expect(queries.get("rider_national_championship_titles")?.eq.mock.calls).toEqual([["rider_id", riderId]]);
  });

  it("gates current national and continental jerseys while retaining every historical title", async () => {
    profileClient([
      title("road"),
      title("road", colombia),
      title("time_trial", colombia, "season-2", "2026-11-01T10:00:00Z"),
      title("continental_europe_road"),
      title("continental_america_time_trial", colombia),
      title("world_road"),
      title("quadrennial_time_trial"),
    ]);

    const profile = await loadProfile();

    expect(profile?.nationalTitles.map((entry) => entry.isActive)).toEqual([false, true, false]);
    expect(profile?.continentalTitles).toMatchObject([
      { continentCode: "europe", type: "road", isActive: false },
      { continentCode: "america", type: "time_trial", isActive: true },
    ]);
    expect(profile?.worldTitles).toMatchObject([{ type: "road", isActive: true }]);
    expect(profile?.quadrennialTitles).toMatchObject([{ type: "time_trial", isActive: true }]);
    expect(profile?.history[0]?.continentalTitles).toMatchObject([
      { continentCode: "europe", type: "road" },
      { continentCode: "america", type: "time_trial" },
    ]);
    expect(profile?.history[0]?.worldTitles).toEqual([{ type: "road" }]);
    expect(profile?.history[0]?.quadrennialTitles).toEqual([{ type: "time_trial" }]);
    expect(loadNationalFederationJerseyDesigns).toHaveBeenCalledExactlyOnceWith([colombia.id], "national_champion");
  });
});
