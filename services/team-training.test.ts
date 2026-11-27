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
  const returnedPlanRiderIds = new Set<unknown>();
  let failingTable: string | null = null;
  const client = { from(table: string) {
    calls.push(table);
    const filters: Array<(row: Row) => boolean> = [];
    let pageStart = 0;
    let pageEnd = 1_000;
    const result = () => ({
      data: (tables[table] ?? []).filter(row => filters.every(filter => filter(row))).slice(pageStart, pageEnd),
      error: table === failingTable ? { message: "read failed" } : null,
    });
    const builder = {
      select: () => builder,
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return builder; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return builder; },
      order: () => builder,
      range(from: number, to: number) { pageStart = from; pageEnd = to + 1; return builder; },
      async returns() {
        const page = result();
        if (table === "rider_training_plan_versions") {
          for (const row of page.data) returnedPlanRiderIds.add(row.rider_id);
        }
        return page;
      },
      async maybeSingle() { const value = result(); return { ...value, data: value.data[0] ?? null }; },
    };
    return builder;
  }, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  return { client, calls, plan, tables, returnedPlanRiderIds, fail(table: string) { failingTable = table; } };
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
  it("loads an active rider’s saved plan past the first response and excludes former riders", async () => {
    const test = fixture("active-coach");
    const fillerRiders = Array.from({ length: 35 }, (_, index) => `rider-${index}`);
    test.tables.rider_contracts.push(...fillerRiders.map((rider_id) => ({ rider_id, team_id: "team", status: "active" })));
    const newerPlans = fillerRiders.flatMap((rider_id) =>
      Array.from({ length: 29 }, (_, index) => ({
        ...test.plan, id: `${rider_id}-${index}`, rider_id, effective_from_day_number: 29 - index,
      })),
    );
    test.plan.effective_from_day_number = 1;
    test.plan.domain = "rouleur";
    test.tables.rider_training_plan_versions.unshift(
      { ...test.plan, rider_id: "departed", effective_from_day_number: 29 },
      ...newerPlans,
    );
    mocks.admin.mockReturnValue(test.client);
    const overview = await getCurrentTeamTrainingOverview("user");
    expect(overview?.riders[0].plan).toMatchObject({ domain: "rouleur", trainerContractId: "active-coach", intensity: 58 });
    expect(test.calls.filter(table => table === "rider_training_plan_versions")).toHaveLength(2);
    expect(test.returnedPlanRiderIds).not.toContain("departed");
  });

  it("never treats an unavailable staff query as an empty list of coaches", async () => {
    const test = fixture("active-coach"); test.fail("staff_contracts"); mocks.admin.mockReturnValue(test.client);
    await expect(getCurrentTeamTrainingOverview("user")).rejects.toThrow("contrats des entraîneurs");
  });
});

describe("recorded training personality bonuses", () => {
  it.each([
    { recorded: 5, current: "fidele", status: "completed", source: "session", inBreakdown: true },
    { recorded: "5", current: "assidu", status: "completed", source: "session", inBreakdown: true },
    { recorded: 0, current: "assidu", status: "completed", source: null, inBreakdown: false },
    { recorded: null, current: "assidu", status: "completed", source: "current", inBreakdown: false },
    { recorded: 5, current: "assidu", status: "skipped_low_form", source: null, inBreakdown: false },
  ])("preserves $recorded with current $current and $status", async ({ recorded, current, status, source, inBreakdown }) => {
    const test = fixture("active-coach");
    test.tables.riders[0].personality_key = current;
    const session = {
      rider_id: "tedla", season_day_id: "day17", status, intensity: 58,
      domain: "stage_racer", minimum_form: 50, trainer_level: 4,
      trainer_specialty: "flat", trainer_country_match: true,
      physiotherapist_level: 0, form_before: 80, form_delta: -2, form_after: 78,
      progress_milli: { mountain: 270 }, decline_milli: {}, rating_changes: {},
      personality_bonus_percentage: recorded,
    };
    mocks.history.mockResolvedValue({ data: [session], error: null });
    mocks.admin.mockReturnValue(test.client);

    const overview = await getCurrentTeamTrainingOverview("user");
    const report = overview?.riders[0].latestReport;
    expect(report?.personalityBonus).toEqual(source ? { percentage: 5, source } : null);
    expect(report?.bonusBreakdownByStat?.mountain?.items.some(item => item.key === "personality-assidu")).toBe(inBreakdown);
    expect(report?.progressMilli).toEqual({ mountain: 270 });
    expect(report?.formAfter).toBe(78);
    expect(session.personality_bonus_percentage).toBe(recorded);
    expect(test.calls.filter(table => table === "riders")).toHaveLength(1);
    expect(mocks.history).toHaveBeenCalledOnce();
  });
});
