import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffAcademyOverview } from "@/services/staff-academy";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
type Row = Record<string, unknown>;

function training(overrides: Row = {}): Row {
  return {
    id: "stage", team_id: "team", staff_contract_id: "contract", staff_member_id: "member",
    improvement_type: "talent", previous_level: 1, previous_talent_count: 1,
    cost: 0, duration_days: 9, starts_game_day_index: 112, completes_game_day_index: 121,
    status: "active", awarded_talent_code: null, completed_at: null, created_at: "2026-01-01",
    educator_cost_reduction_percentage: 0, educator_duration_reduction_percentage: 6,
    federal_duration_reduction_percentage: 0, educator_mentorship_reduction_days: 0,
    educator_talent_choice_count: 2, talent_choice_codes: [], ...overrides,
  };
}

function fixture(trainings: Row[], role = "mechanic", level = 1) {
  const tables: Record<string, Row[]> = {
    sporting_directors: [{id: "director", auth_user_id: "owner", status: "active"}],
    team_manager_assignments: [{sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active"}],
    seasons: [{id: "season", game_year: 4, current_day_number: 12, status: "active"}],
    team_seasons: [{team_id: "team", season_id: "season", registration_country_id: "fr"}],
    team_infrastructures: [{team_id: "team", infrastructure_code: "staff_academy", level: 1}],
    staff_contracts: [{id: "contract", staff_member_id: "member", team_id: "team", status: "active"}],
    staff_members: [{id: "member", first_name: "Jean", last_name: "Test", role, level, country_id: "fr", trainer_specialty: null}],
    staff_member_talents: [{staff_member_id: "member", slot_number: 1, talent_code: role === "financial_director" ? "finance_race_prizes" : "mechanic_incident_time"}],
    staff_academy_trainings: trainings,
    national_federation_infrastructures: [], national_federation_infrastructure_specializations: [],
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; }),
      neq: vi.fn((key: string, value: unknown) => { rows = rows.filter(row => row[key] !== value); return query; }),
      in: vi.fn((key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; }),
      order: vi.fn((key: string, {ascending = true}: {ascending?: boolean} = {}) => {
        rows.sort((a,b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)); return query;
      }),
      limit: vi.fn((count: number) => { rows = rows.slice(0,count); return query; }),
      maybeSingle: vi.fn(async () => ({data: rows[0] ?? null, error: null})),
      returns: vi.fn(async () => ({data: rows, error: null})),
    };
    return query;
  });
  mocks.createAdmin.mockReturnValue({from, rpc: vi.fn(async () => ({
    data: { activeEducatorCount: 1, costReductionPercentage: 0, durationReductionPercentage: 6,
      mentorshipReductionDays: 1, talentChoiceCount: 2, extraCapacity: 0 }, error: null,
  }))});
}
const overview = () => getStaffAcademyOverview({} as Parameters<typeof getStaffAcademyOverview>[0], "owner");
beforeEach(() => vi.clearAllMocks());

describe("staff academy overview", () => {
  it.each([[1,false],[2,true],[3,true],[4,true],[5,true]] as const)("respects financial director level %i before proposing another affix", async (level, eligible) => {
    fixture([], "financial_director", level);
    const result = await overview();
    expect(result?.members[0].roleLabel).toBe("Directeur financier");
    expect(result?.members[0].canAddTalent).toBe(eligible);
    expect(result?.members[0].talents).toHaveLength(1);
  });
  it("shows a pending choice without consuming capacity and still reserves its member", async () => {
    fixture([training({talent_choice_codes: ["mechanic_wheel_efficiency","mechanic_frame_efficiency"]})]);
    const result = await overview();
    expect(result?.activeTrainingCount).toBe(0);
    expect(result?.activeTrainings).toHaveLength(0);
    expect(result?.pendingTalentChoices).toHaveLength(1);
    expect(result?.pendingTalentChoices[0].talentChoices.map(choice => choice.code))
      .toEqual(["mechanic_wheel_efficiency","mechanic_frame_efficiency"]);
    expect(result?.members[0].activeTrainingId).toBe("stage");
    expect(result?.members[0].levelTraining.durationDays).toBe(4);
    expect(result?.members[0].talentTraining.talentChoiceCount).toBe(2);
  });

  it("does not hide pending choices behind the 30 most recent completed courses", async () => {
    fixture([
      training({talent_choice_codes: ["mechanic_wheel_efficiency","mechanic_frame_efficiency"]}),
      ...Array.from({length: 35},(_,i) => training({id: `completed-${i}`, status: "completed",
        created_at: "2026-10-12", talent_choice_codes: [], awarded_talent_code: "mechanic_frame_efficiency"})),
    ]);
    const result = await overview();
    expect(result?.recentTrainings).toHaveLength(30);
    expect(result?.pendingTalentChoices[0].id).toBe("stage");
  });

  it("counts ongoing courses normally and leaves historical duration, cost and bonuses untouched", async () => {
    fixture([training({educator_talent_choice_count: 1, cost: 525000, duration_days: 13,
      educator_cost_reduction_percentage: 25, educator_duration_reduction_percentage: 35})]);
    const result = await overview();
    expect(result?.activeTrainingCount).toBe(1);
    expect(result?.pendingTalentChoices).toHaveLength(0);
    expect(result?.activeTrainings[0]).toMatchObject({cost: 525000, durationDays: 13,
      educatorCostReductionPercentage: 25, educatorDurationReductionPercentage: 35, educatorTalentChoiceCount: 1});
  });
});
