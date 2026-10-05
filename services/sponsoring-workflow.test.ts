import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(), future: vi.fn(), continuing: vi.fn(), objectives: vi.fn(), history: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/future-sponsor-offers", () => ({ getOrCreateFutureSponsorOffersForAuthUser: mocks.future }));
vi.mock("@/services/continuing-sponsor-objectives", () => ({ ensureContinuingSponsorObjectivePlan: mocks.continuing }));
vi.mock("@/services/persisted-sponsor-objectives", () => ({ ensureAndLoadSponsorObjectives: mocks.objectives }));
vi.mock("@/services/sponsor-budget-history", () => ({ getSponsorBudgetHistoryForTeam: mocks.history }));
import { getSponsoringStateForAuthUser } from "./sponsoring-workflow";

const activeSeason = { id: "s3", game_year: 3, name: "Saison 3", starts_on: "2026-09-11", ends_on: "2026-10-08", current_day_number: 25 };
const nextSeason = { id: "s4", game_year: 4, name: "Saison 4" };
const history = [{ gameYear: 3, budget: 300000 }];
const persistedObjective = { id: "objective", name: "Un objectif", description: null, displayOrder: 1, status: "active", satisfactionPoints: 15, targetDetails: {}, mainObjectiveTerms: null };
function contract(status = "active", duration = 1) {
  return {
    id: "contract", sponsor_id: "sponsor", sponsor_offer_id: "current-offer", start_season_id: "s3", objective_season_id: "s3",
    budget_per_season: 300000, currency_code: "EUR", contract_duration_seasons: duration, status,
    selected_jersey_id: "jersey", selected_jersey_style: "classic", pending_jersey_id: null, pending_jersey_style: null,
    pending_jersey_season_id: null, signed_at: null, activated_at: null, completed_at: null, terminated_at: null,
    termination_reason: null, reputation_penalty: 0, reputation_investment_cost: 0, reputation_budget_bonus_percent: 0, satisfaction_score: 50,
  };
}
function client({ current = null, planned = null, terminated = null, reputation = 100, day = 25, nextSeasonError = null, currentContractError = null }: {
  current?: ReturnType<typeof contract> | null; planned?: ReturnType<typeof contract> | null; terminated?: ReturnType<typeof contract> | null;
  reputation?: number; day?: number; nextSeasonError?: string | null; currentContractError?: string | null;
} = {}) {
  const from = vi.fn((table: string) => {
    const filters = new Map<string, unknown>();
    const response = () => {
      if (table === "sporting_directors") return { data: { id: "director", reputation_points: reputation }, error: null };
      if (table === "team_manager_assignments") return { data: [{ team_id: "team" }], error: null };
      if (table === "seasons") {
        if (filters.get("game_year") === 4) return { data: nextSeason, error: nextSeasonError ? { message: nextSeasonError } : null };
        return { data: { ...activeSeason, current_day_number: day }, error: null };
      }
      if (table === "team_sponsor_contracts") {
        const status = filters.get("status");
        const selected = status === "active" ? current : status === "terminated" ? terminated : planned;
        const error = status === "active" && currentContractError ? { message: currentContractError } : null;
        return { data: selected ? [selected] : [], error };
      }
      if (table === "sponsors") return { data: { catalog_key: SPONSORS[0].id }, error: null };
      if (table === "sponsor_satisfaction_events") return { data: [], error: null };
      if (table === "objective_progress") return { data: [{ sponsor_objective_id: "objective", current_value: 3, status: "in_progress", details: { targetValue: 5 } }], error: null };
      throw new Error(`Unexpected sponsor query: ${table}`);
    };
    const query = {
      select: vi.fn(), eq: vi.fn((key: string, value: unknown) => { filters.set(key, value); return query; }),
      in: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => response()), returns: vi.fn(async () => response()),
    };
    for (const method of [query.select, query.in, query.order, query.limit]) method.mockReturnValue(query);
    return query;
  });
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  mocks.admin.mockReturnValue({ from, rpc });
  return { from, rpc };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.history.mockResolvedValue(history);
  mocks.objectives.mockResolvedValue(new Map([["current-offer", [persistedObjective]]]));
  mocks.future.mockResolvedValue({ mode: "first-contract", season: { id: "s4", name: "Saison 4", gameYear: 4 }, offers: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("sponsor page future-season fault isolation", () => {
  it("keeps the active contract, objectives, progress and budgets when future team enrollment fails", async () => {
    client({ current: contract() });
    const error = new Error('record "v_catalog" has no field "tour_name"');
    mocks.future.mockRejectedValue(error);
    const state = await getSponsoringStateForAuthUser("player");
    expect(state).toMatchObject({ kind: "active", budgetHistory: history, contract: {
      id: "contract", budgetPerSeason: 300000, objectives: [{ id: "objective", currentValue: 3, targetValue: 5 }],
    }, future: { kind: "unavailable", targetGameYear: 4, targetSeasonName: "Saison 4" } });
    expect(console.error).toHaveBeenCalledWith("Impossible de préparer le sponsoring de la saison suivante :", error);
  });
  it("keeps the amateur state for a Jphilou-like player if generating offers fails", async () => {
    client({ reputation: 30 });
    mocks.future.mockRejectedValue(new Error("future trigger unavailable"));
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "amateur-qualified", future: { kind: "unavailable" }, budgetHistory: history });
  });
  it("keeps the terminated contract visible if replacement offers fail", async () => {
    client({ terminated: contract("terminated") });
    mocks.future.mockRejectedValue(new Error("replacement unavailable"));
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "terminated", contract: { id: "contract" }, future: { kind: "unavailable" } });
  });
  it("isolates next-season lookup failures as well", async () => {
    client({ current: contract(), nextSeasonError: "lookup offline" });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "active", future: { kind: "unavailable" } });
    expect(mocks.future).not.toHaveBeenCalled();
  });
  it("isolates annual renegotiation failures without hiding the continuing contract", async () => {
    client({ current: contract("active", 2) });
    mocks.continuing.mockRejectedValue(new Error("annual plan unavailable"));
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "active", contract: { contractDurationSeasons: 2 }, future: { kind: "unavailable" } });
  });
  it("retries normally on the next visit instead of caching a failure", async () => {
    client({ reputation: 30 });
    mocks.future.mockRejectedValueOnce(new Error("temporary"));
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ future: { kind: "unavailable" } });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ future: { kind: "offers", season: { gameYear: 4 } } });
    expect(mocks.future).toHaveBeenCalledTimes(2);
  });
  it("retains the successful offers workflow and does not log an error", async () => {
    client({ reputation: 30 });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "amateur-qualified", future: { kind: "offers" } });
    expect(console.error).not.toHaveBeenCalled();
  });
  it("does not generate offers before day 21 or when reputation is insufficient", async () => {
    client({ current: contract(), day: 20 });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ future: { kind: "locked" } });
    client({ reputation: 0 });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "locked" });
    expect(mocks.future).not.toHaveBeenCalled();
  });
  it("does not conceal a failure to load the current contract", async () => {
    client({ currentContractError: "current contract offline" });
    await expect(getSponsoringStateForAuthUser("player")).rejects.toThrow("current contract offline");
    expect(console.error).not.toHaveBeenCalled();
  });
  it("retains the current planned jersey-selection workflow", async () => {
    client({ planned: contract("planned") });
    expect(await getSponsoringStateForAuthUser("player")).toMatchObject({ kind: "jersey-selection", contract: { id: "contract" } });
    expect(mocks.future).not.toHaveBeenCalled();
  });
});
