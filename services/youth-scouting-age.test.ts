import { beforeEach, describe, expect, it, vi } from "vitest";
import { getYouthDevelopmentOverview } from "./youth-development";
import { isYouthScoutingMissionArchived } from "@/lib/game/youth-scouting-history";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/services/team-roster-capacity", () => ({ loadTeamRosterCapacitySummary: vi.fn(async () => ({ commitmentCount: 0, totalLimit: 30, youthReserveSlots: 3 })) }));
vi.mock("@/services/scouting-visibility", () => ({ getTeamSeasonScoutingVisibility: vi.fn(async () => ({ active: false, activeUntil: null })) }));

type Row = Record<string, unknown>;
function fixture({ gameYear = 4, missingSeason = false, seasonError = false } = {}) {
  const missions = [null, "2026-09-01T12:00:00Z"].map((viewed, index) => ({
    id: `mission-${index}`, team_id: "team", season_id: "s3", country_id: "fr", scout_contract_id: "scout",
    start_day_number: 1, duration_days: 3, completes_day_number: 4, status: "completed", report_viewed_at: viewed,
  }));
  const candidates = missions.flatMap((mission) => [15, 17, 18].map((age) => ({
    id: `${mission.id}-${age}`, mission_id: mission.id, report_slot: age - 14, country_id: "fr", first_name: "Test", last_name: "Junior", age,
    status: "spotted", archetype: "climber", potential_steps: 4, avatar_profile_key: "default", avatar_seed: 1,
    mountain: 4, hills: 3, flat: 3, time_trial: 3, cobbles: 3, sprint: 3, acceleration: 3, downhill: 3,
    endurance: 3, resistance: 3, recovery: 3, breakaway: 3, prologue: 3, signing_fee: 1000, tuition_per_season: 100,
    adult_height_cm: 180, adult_weight_kg: 70, growth_pattern: "steady", physiology_version: 1,
    native_special_ability_code: null, historical_archetype: null, school_plan_archetype: null, archetype_probabilities: null,
    international_center_bonus_applied: false, international_center_bonus_percentage: 0,
    scout_training_bonus_percentage: 5, federal_tuition_reduction_percentage: 0, scout_tuition_reduction_percentage: 0,
  })));
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "viewer", status: "active" }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active" }],
    seasons: [{ id: "current", name: "Saison actuelle", game_year: gameYear, status: "active", current_day_number: 6 },
      ...(!missingSeason ? [{ id: "s3", name: "Saison 3", game_year: 3, status: "completed", current_day_number: 28 }] : [])],
    team_seasons: [{ id: "team-season", team_id: "team", season_id: "current", display_name: "Test", currency: "EUR", cash_balance: 100000, registration_country_id: "fr" }],
    countries: [{ id: "fr", iso_alpha2: "FR", name: "France", is_active: true }],
    youth_scouting_missions: missions, youth_scouting_candidates: candidates,
  };
  const seasonQueries: unknown[][] = [];
  const from = vi.fn((table: string) => {
    let data = [...(tables[table] ?? [])];
    let error: { message: string } | null = null;
    const result = () => ({ data, error });
    const query = {
      select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: unknown) => { data = data.filter((row) => row[field] === value); return query; }),
      in: vi.fn((field: string, values: unknown[]) => {
        data = data.filter((row) => values.includes(row[field]));
        if (table === "seasons") { seasonQueries.push(values); if (seasonError) error = { message: "lecture indisponible" }; }
        return query;
      }),
      maybeSingle: vi.fn(async () => ({ data: data[0] ?? null, error })),
      returns: vi.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  const client = { from, rpc: vi.fn(async (name: string) => ({ data: name === "get_youth_scouting_country_uci_rankings" ? [] : 0, error: null })) };
  mocks.createAdmin.mockReturnValue(client);
  return { client: client as unknown as Parameters<typeof getYouthDevelopmentOverview>[0], candidates, seasonQueries };
}

beforeEach(() => vi.clearAllMocks());
describe("rapports consultés et laissés dans le scouting", () => {
  it("charge la saison du rapport et applique le même vieillissement aux deux listes", async () => {
    const { client, candidates, seasonQueries } = fixture();
    const source = structuredClone(candidates);
    const overview = await getYouthDevelopmentOverview(client, "viewer");
    expect(overview?.missions).toHaveLength(2);
    expect(overview!.missions.map(isYouthScoutingMissionArchived)).toEqual([false, true]);
    for (const mission of overview!.missions) {
      expect(mission.candidates.map(({ age, status }) => ({ age, status }))).toEqual([
        { age: 16, status: "spotted" }, { age: 18, status: "spotted" }, { age: 19, status: "expired" },
      ]);
      expect(mission.candidates[1].heightCm).toBe(180);
    }
    expect(seasonQueries).toEqual([["s3"]]); // One batched query, not one request per rider.
    expect(candidates).toEqual(source); // No mutation of historical scouting data.
  });
  it("reste correct plusieurs saisons plus tard sans traitement de bascule dédié", async () => {
    const { client } = fixture({ gameYear: 6 });
    const overview = await getYouthDevelopmentOverview(client, "viewer");
    expect(overview!.missions[0].candidates.map(({ age, status }) => ({ age, status }))).toEqual([
      { age: 18, status: "spotted" }, { age: 20, status: "expired" }, { age: 21, status: "expired" },
    ]);
  });
  it.each([{ missingSeason: true }, { seasonError: true }])("ne rend pas un candidat recrutable avec une saison illisible : %j", async (options) => {
    const { client } = fixture(options);
    await expect(getYouthDevelopmentOverview(client, "viewer")).rejects.toThrow(/saison/);
  });
});
