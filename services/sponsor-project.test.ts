import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ queries: [] as { table: string; filters: [string, unknown][]; limits: number[]; selection: string; signal?: AbortSignal }[],
  contract: null as unknown, objectives: [] as unknown[], errorAt: "", rpc: vi.fn() }));
vi.mock("@/data/sponsors", () => ({ SPONSORS: [{ id: "abbaye-du-lion", name: "Abbaye du Lion" }] }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc, from: (table: string) => {
  const record = { table, filters: [] as [string, unknown][], limits: [] as number[], selection: "", signal: undefined as AbortSignal | undefined };
  state.queries.push(record);
  const result = () => ({ data: table === "team_sponsor_contracts" ? state.contract : state.objectives, error: state.errorAt === table ? { message: "unavailable" } : null });
  const query = {
    select: (value: string) => { record.selection = value; return query; },
    eq: (key: string, value: unknown) => { record.filters.push([key, value]); return query; },
    neq: (key: string, value: unknown) => { record.filters.push([`not:${key}`, value]); return query; },
    order: () => query, limit: (value: number) => { record.limits.push(value); return query; },
    abortSignal: (value: AbortSignal) => { record.signal = value; return query; },
    maybeSingle: async () => result(), returns: async () => result(),
  }; return query;
} }) }));
import { getTeamSponsorProject } from "./sponsor-project";

describe("bounded read-only sponsor project loading", () => {
  beforeEach(() => {
    state.queries = []; state.errorAt = ""; state.rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.contract = { id: "contract", sponsor_offer_id: "offer", start_season_id: "s3", objective_season_id: "s4", satisfaction_score: 45,
      sponsors: { catalog_key: "abbaye-du-lion" } };
    state.objectives = [{ id: "objective", name: "Quota", status: "active", display_order: 1, satisfaction_points: 20,
      target_details: { kind: "nationality_quota", countryCode: "BE", minimumPercentage: 75, sportingPhilosophy: "youth_development" },
      objective_progress: [{ current_value: "70", status: "in_progress", details: { targetValue: 75 } }], sponsor_main_objective_terms: null }];
  });
  it("performs only two capped selects, scoped to the authenticated team, principal contract and annual season", async () => {
    const project = await getTeamSponsorProject("own-team");
    expect(project?.seasonId).toBe("s4"); expect(project?.satisfactionScore).toBe(45);
    expect(project?.philosophy).toBe("youth_development"); // Signed snapshot wins over the catalogue's national preference.
    expect(project?.objectives[0].currentValue).toBe(70);
    expect(state.queries).toHaveLength(2); expect(state.rpc).not.toHaveBeenCalled();
    expect(state.queries[0].filters).toEqual([["team_id", "own-team"], ["role", "principal"], ["status", "active"]]);
    expect(state.queries[0].limits).toEqual([1]);
    expect(state.queries[1].filters).toEqual([["sponsor_offer_id", "offer"], ["season_id", "s4"], ["not:status", "draft"], ["objective_progress.team_sponsor_contract_id", "contract"], ["objective_progress.season_id", "s4"]]);
    expect(state.queries[1].limits).toEqual([10, 1, 1]);
    expect(state.queries.every(query => query.signal instanceof AbortSignal)).toBe(true);
  });
  it("makes no read without a team, and only one without an active contract", async () => {
    expect(await getTeamSponsorProject(null)).toBeNull(); expect(state.queries).toHaveLength(0);
    state.contract = null; expect(await getTeamSponsorProject("team")).toBeNull(); expect(state.queries).toHaveLength(1);
  });
  it("does not regenerate a missing objective plan or turn unknown progress into zero", async () => {
    state.objectives = []; expect((await getTeamSponsorProject("team"))?.objectives).toEqual([]);
    state.queries = [];
    state.objectives = [{ ...(state.objectives[0] as object), id: "unknown", name: "Quota", status: "active", display_order: 1, satisfaction_points: 10,
      target_details: { kind: "nationality_quota", countryCode: "BE", minimumPercentage: 75 }, objective_progress: [], sponsor_main_objective_terms: [] }];
    expect((await getTeamSponsorProject("team"))?.objectives[0].currentValue).toBeNull();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each(["team_sponsor_contracts", "sponsor_objectives"])("fails open without retries if %s is unavailable", async table => {
    state.errorAt = table; expect(await getTeamSponsorProject("team")).toBeNull();
    expect(state.queries).toHaveLength(table === "team_sponsor_contracts" ? 1 : 2);
  });
  it("uses start season for a first-year contract and tolerates one-to-one embeds", async () => {
    (state.contract as { objective_season_id: string | null }).objective_season_id = null;
    const objective = state.objectives[0] as { objective_progress: unknown; sponsor_main_objective_terms: unknown };
    objective.objective_progress = { current_value: 1, status: "achieved", details: { achievementLevel: "partial", partialSatisfactionPoints: 3 } };
    objective.sponsor_main_objective_terms = { cash_reward: 100000, currency_code: "EUR", reputation_penalty: 20, race_category_code: "national", settlement_status: "pending" };
    const project = await getTeamSponsorProject("team");
    expect(project?.seasonId).toBe("s3"); expect(project?.objectives[0].partialSatisfactionPoints).toBe(3);
    expect(project?.objectives[0].mainObjectiveTerms?.cashReward).toBe(100000);
  });
});
