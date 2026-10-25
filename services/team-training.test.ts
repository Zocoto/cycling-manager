import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/team-training-history", () => ({ loadTeamTrainingHistory: mocks.history }));
import { getCurrentTeamTrainingOverview } from "./team-training";

type Row = Record<string, unknown>;
function fixture(trainerContractId: string | null) {
  const plan = { rider_id: "tedla", team_id: "team", season_id: "s4", intensity: 58, domain: "stage_racer", trainer_contract_id: trainerContractId, effective_from_day_number: 4, created_at: "2026-10-11T06:11:15Z" };
  const ratings = Object.fromEntries(["mountain", "hills", "flat", "time_trial", "cobbles", "sprint", "acceleration", "downhill", "endurance", "resistance", "recovery", "breakaway", "prologue"].map(key => [key, 55]));
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active" }],
    team_manager_assignments: [{ team_id: "team", sporting_director_id: "director", role: "general_manager", status: "active" }],
    seasons: [{ id: "s4", name: "Saison 4", status: "active", current_day_number: 17 }],
    team_seasons: [{ team_id: "team", season_id: "s4", display_name: "Cidrerie de l’Aulne", registration_country_id: "country" }],
    season_days: [{ id: "day17", season_id: "s4", day_number: 17, calendar_date: "2026-10-25" }],
    rider_contracts: [{ rider_id: "tedla", team_id: "team", status: "active", squad_status: "domestique" }],
    rider_training_plan_versions: [plan],
    staff_contracts: [
      { id: "active-coach", staff_member_id: "coach", team_id: "team", status: "active" },
      { id: "terminated-coach", staff_member_id: "old", team_id: "team", status: "terminated" },
      { id: "foreign-coach", staff_member_id: "foreign", team_id: "other", status: "active" },
      { id: "not-a-coach", staff_member_id: "scout", team_id: "team", status: "active" },
    ],
    staff_members: [
      { id: "coach", role: "trainer", country_id: "country", first_name: "Jean", last_name: "Actif", level: 4, trainer_specialty: "flat" },
      { id: "old", role: "trainer", country_id: "country", first_name: "Abdalla", last_name: "Didi", level: 4, trainer_specialty: "flat" },
      { id: "foreign", role: "trainer", country_id: "country", first_name: "Autre", last_name: "Équipe", level: 4, trainer_specialty: "flat" },
      { id: "scout", role: "scout", country_id: "country", first_name: "Un", last_name: "Scout", level: 4, trainer_specialty: null },
    ],
    riders: [{ id: "tedla", country_id: "country", first_name: "Tedla", last_name: "Weldesimon", potential_steps: 4, decline_resistance_multiplier: 1 }],
    rider_season_ratings: [{ ...ratings, rider_id: "tedla", season_id: "s4", age: 19 }],
    countries: [{ id: "country", name: "Rwanda", iso_alpha2: "RW" }],
  };
  const calls: string[] = [];
  let failingTable: string | null = null;
  const client = { from(table: string) {
    calls.push(table);
    const filters: Array<(row: Row) => boolean> = [];
    const result = () => ({ data: (tables[table] ?? []).filter(row => filters.every(filter => filter(row))), error: table === failingTable ? { message: "read failed" } : null });
    const builder = {
      select: () => builder,
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return builder; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return builder; },
      order: () => builder,
      async returns() { return result(); },
      async maybeSingle() { const value = result(); return { ...value, data: value.data[0] ?? null }; },
    };
    return builder;
  }, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  return { client, calls, plan, fail(table: string) { failingTable = table; } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.history.mockResolvedValue({ data: [], error: null }); });

describe("editable training coach references", () => {
  it.each(["terminated-coach", "foreign-coach", "missing-coach", "not-a-coach", null])("normalizes %s without altering the saved history or the program", async coach => {
    const test = fixture(coach); mocks.admin.mockReturnValue(test.client);
    const overview = await getCurrentTeamTrainingOverview("user");
    expect(overview?.riders[0].plan).toMatchObject({ intensity: 58, domain: "stage_racer", trainerContractId: null, effectiveFromDayNumber: 4 });
    expect(overview?.trainers.map(trainer => trainer.contractId)).toEqual(["active-coach"]);
    expect(test.plan.trainer_contract_id).toBe(coach);
    expect(test.calls.filter(table => table === "staff_contracts")).toHaveLength(1);
  });
  it("keeps a current team coach and its assignment count", async () => {
    const test = fixture("active-coach"); mocks.admin.mockReturnValue(test.client);
    const overview = await getCurrentTeamTrainingOverview("user");
    expect(overview?.riders[0].plan.trainerContractId).toBe("active-coach");
    expect(overview?.trainers[0].assignedRiderCount).toBe(1);
  });
  it("never treats an unavailable staff query as an empty list of coaches", async () => {
    const test = fixture("active-coach"); test.fail("staff_contracts"); mocks.admin.mockReturnValue(test.client);
    await expect(getCurrentTeamTrainingOverview("user")).rejects.toThrow("contrats des entraîneurs");
  });
});
