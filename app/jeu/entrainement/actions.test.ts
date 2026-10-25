import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingPlanDraft } from "@/lib/game/training-plan-drafts";
import type { TrainingPlansSaveState } from "@/lib/game/training-plan-save-state";

const mocks = vi.hoisted(() => ({ client: vi.fn(), auth: vi.fn(), rpc: vi.fn(), path: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { saveRiderTrainingPlansAction } from "./actions";

const riderA = "00000000-0000-4000-8000-000000000001";
const riderB = "00000000-0000-4000-8000-000000000002";
const trainer = "00000000-0000-4000-8000-000000000003";
const planA: TrainingPlanDraft = { riderId: riderA, intensity: 58, domain: "stage_racer", trainerContractId: trainer };
const planB: TrainingPlanDraft = { riderId: riderB, intensity: 42, domain: "climber", trainerContractId: null };
const initial: TrainingPlansSaveState = { status: "idle", message: null, savedPlans: [], failures: [] };
function form(plans: unknown = [planA, planB]) { const data = new FormData(); data.set("plans", JSON.stringify(plans)); return data; }
function result(rows: unknown[]) { return { data: { effective_day: 18, results: rows }, error: null }; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.auth }, rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue(result([{ rider_id: riderA, status: "saved" }, { rider_id: riderB, status: "saved" }]));
});

describe("training batch server action", () => {
  it("makes one authenticated batch RPC, acknowledges each saved row and does not redirect", async () => {
    const state = await saveRiderTrainingPlansAction(initial, form());
    expect(state).toMatchObject({ status: "success", savedPlans: [planA, planB], failures: [], effectiveDay: 18, submittedPlans: [planA, planB] });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_current_rider_training_plans_v2", { p_plans: [
      { rider_id: riderA, intensity: 58, domain: "stage_racer", trainer_contract_id: trainer },
      { rider_id: riderB, intensity: 42, domain: "climber", trainer_contract_id: null },
    ] });
    expect(mocks.path.mock.calls.map(([path]) => path)).toEqual(["/jeu/entrainement", "/jeu/effectif", "/jeu"]);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps the successful rows when another rider fails, with an explicit row error", async () => {
    mocks.rpc.mockResolvedValue(result([{ rider_id: riderA, status: "error", code: "trainer_full", message: "Quota atteint." }, { rider_id: riderB, status: "saved" }]));
    const state = await saveRiderTrainingPlansAction(initial, form());
    expect(state).toMatchObject({ status: "partial", savedPlans: [planB], submittedPlans: [planA, planB], failures: [{ riderId: riderA, code: "trainer_full", message: "Quota atteint." }] });
    expect(state.message).toContain("1 programme enregistré");
    expect(state.message).toContain("1 programme reste à corriger");
  });
  it("acknowledges the actual trainer reset without losing the original submission", async () => {
    mocks.rpc.mockResolvedValue(result([{ rider_id: riderA, status: "saved", trainer_reset: true, trainer_contract_id: null }]));
    const state = await saveRiderTrainingPlansAction(initial, form([planA]));
    expect(state.savedPlans).toEqual([{ ...planA, trainerContractId: null }]);
    expect(state.submittedPlans).toEqual([planA]);
  });
  it("does not invalidate unrelated data when every rider was refused", async () => {
    mocks.rpc.mockResolvedValue(result([{ rider_id: riderA, status: "error", message: "Coureur transféré." }]));
    expect((await saveRiderTrainingPlansAction(initial, form([planA]))).status).toBe("error");
    expect(mocks.path).not.toHaveBeenCalled();
  });
  it("rejects only the malformed program and still saves the valid one", async () => {
    mocks.rpc.mockResolvedValue(result([{ rider_id: riderB, status: "saved" }]));
    const state = await saveRiderTrainingPlansAction(initial, form([{ ...planA, intensity: 120 }, planB]));
    expect(state.status).toBe("partial");
    expect(state.savedPlans).toEqual([planB]);
    expect(state.failures).toEqual([expect.objectContaining({ riderId: riderA, code: "invalid_plan" })]);
    expect(mocks.rpc.mock.calls[0][1].p_plans).toHaveLength(1);
  });
  it("refuses duplicate rider entries without blocking other riders", async () => {
    mocks.rpc.mockResolvedValue(result([{ rider_id: riderB, status: "saved" }]));
    const state = await saveRiderTrainingPlansAction(initial, form([planA, { ...planA, intensity: 70 }, planB]));
    expect(state.savedPlans).toEqual([planB]);
    expect(state.failures).toEqual([expect.objectContaining({ riderId: riderA, code: "duplicate_rider" })]);
  });
  it.each([[], null, "invalid", Array.from({ length: 36 }, () => planA)])("refuses malformed envelopes: %j", async plans => {
    expect((await saveRiderTrainingPlansAction(initial, form(plans))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains every draft when the RPC times out", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "canceling statement due to lock timeout" } });
    const state = await saveRiderTrainingPlansAction(initial, form());
    expect(state).toMatchObject({ status: "error", savedPlans: [], submittedPlans: [planA, planB] });
    expect(state.message).toContain("réessayer"); expect(mocks.path).not.toHaveBeenCalled();
  });
  it("does not falsely claim a rollback after a lost network response", async () => {
    mocks.rpc.mockRejectedValue(new Error("network"));
    const state = await saveRiderTrainingPlansAction(initial, form());
    expect(state.savedPlans).toEqual([]); expect(state.message).toContain("confirmer");
    expect(state.submittedPlans).toEqual([planA, planB]);
  });
  it.each([
    { effective_day: 18, results: [{ rider_id: riderA, status: "saved" }] },
    { effective_day: 18, results: [{ rider_id: riderA, status: "saved" }, { rider_id: riderA, status: "saved" }] },
    { effective_day: 18, results: [{ rider_id: trainer, status: "saved" }, { rider_id: riderB, status: "saved" }] },
    { effective_day: 99, results: [] },
  ])("does not acknowledge an incomplete or inconsistent response: %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    const state = await saveRiderTrainingPlansAction(initial, form());
    expect(state.status).toBe("error"); expect(state.savedPlans).toEqual([]); expect(mocks.path).not.toHaveBeenCalled();
  });
  it("does not write without an authenticated session", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    await expect(saveRiderTrainingPlansAction(initial, form())).rejects.toThrow("redirect:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("canonicalizes UUID casing before matching the SQL acknowledgements", async () => {
    const upperRider = "ABCDEFAB-0000-4000-8000-ABCDEFABCDEF";
    const lowerRider = upperRider.toLowerCase();
    mocks.rpc.mockResolvedValue(result([{ rider_id: lowerRider, status: "saved" }]));
    const state = await saveRiderTrainingPlansAction(initial, form([{ ...planA, riderId: upperRider }]));
    expect(state.status).toBe("success");
    expect(state.savedPlans[0].riderId).toBe(lowerRider);
  });
});
