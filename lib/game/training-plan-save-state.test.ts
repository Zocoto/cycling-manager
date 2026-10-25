import { describe, expect, it } from "vitest";
import { getChangedTrainingPlanIds, type TrainingPlanDraft } from "@/lib/game/training-plan-drafts";
import {
  INITIAL_TRAINING_PLANS_SAVE_STATE,
  acknowledgeTrainingPlansSave,
  createTrainingPlansEditorState,
  rebaseTrainingPlansEditorState,
  type TrainingPlansEditorState,
  type TrainingPlansSaveState,
} from "@/lib/game/training-plan-save-state";

const a: TrainingPlanDraft = { riderId: "a", intensity: 50, domain: "climber", trainerContractId: "trainer-a" };
const b: TrainingPlanDraft = { riderId: "b", intensity: 40, domain: "sprinter", trainerContractId: null };
const submittedA = { ...a, intensity: 65 };
const submittedB = { ...b, intensity: 70 };
const result: TrainingPlansSaveState = {
  status: "partial", message: "Une ligne enregistrée.", savedPlans: [submittedA],
  submittedPlans: [submittedA, submittedB],
  failures: [{ riderId: "b", code: "invalid_trainer", message: "Entraîneur indisponible." }],
  effectiveDay: 18,
};
function editedState() {
  const state = createTrainingPlansEditorState([a, b], "initial");
  return { ...state, plansByRiderId: { a: submittedA, b: submittedB } };
}
function dirtyIds(state: TrainingPlansEditorState) {
  return getChangedTrainingPlanIds(Object.values(state.baselineByRiderId), Object.values(state.plansByRiderId));
}

describe("training save acknowledgements", () => {
  it("starts without any claimed save or failure", () => {
    expect(INITIAL_TRAINING_PLANS_SAVE_STATE).toEqual({ status: "idle", message: null, savedPlans: [], failures: [] });
  });
  it("acknowledges only successful rows and keeps failed settings for a targeted retry", () => {
    const previous = editedState();
    const next = acknowledgeTrainingPlansSave(previous, result);
    expect(next.baselineByRiderId).toEqual({ a: submittedA, b });
    expect(next.plansByRiderId).toEqual({ a: submittedA, b: submittedB });
    expect(dirtyIds(next)).toEqual(["b"]);
    expect(previous.baselineByRiderId.a).toEqual(a);
  });
  it("never acknowledges an entirely failed or uncertain request", () => {
    const previous = editedState();
    expect(acknowledgeTrainingPlansSave(previous, { ...result, status: "error", savedPlans: [] })).toBe(previous);
    expect(dirtyIds(previous)).toEqual(["a", "b"]);
  });
  it("keeps a newer edit made while the submitted version was being saved", () => {
    const previous = editedState();
    previous.plansByRiderId.a = { ...submittedA, intensity: 80, domain: "rouleur" };
    const next = acknowledgeTrainingPlansSave(previous, result);
    expect(next.baselineByRiderId.a).toEqual(submittedA);
    expect(next.plansByRiderId.a).toEqual({ ...submittedA, intensity: 80, domain: "rouleur" });
    expect(dirtyIds(next)).toEqual(["a", "b"]);
  });
  it("uses the effective null trainer returned by the server, not an invisible expired reference", () => {
    const next = acknowledgeTrainingPlansSave(editedState(), {
      ...result,
      savedPlans: [{ ...submittedA, trainerContractId: null }],
    });
    expect(next.plansByRiderId.a.trainerContractId).toBeNull();
    expect(next.baselineByRiderId.a.trainerContractId).toBeNull();
    expect(dirtyIds(next)).toEqual(["b"]);
  });
  it("ignores acknowledgements for a rider removed from the current roster", () => {
    const previous = createTrainingPlansEditorState([b], "new-roster");
    const next = acknowledgeTrainingPlansSave(previous, result);
    expect(Object.keys(next.plansByRiderId)).toEqual(["b"]);
    expect(Object.keys(next.baselineByRiderId)).toEqual(["b"]);
  });
  it("supports the no-reset case without an additional submittedPlans payload", () => {
    const withoutSubmitted = { ...result, submittedPlans: undefined };
    expect(dirtyIds(acknowledgeTrainingPlansSave(editedState(), withoutSubmitted))).toEqual(["b"]);
  });
});

describe("training revalidation reconciliation", () => {
  it.each(["response-first", "server-tree-first"])("keeps a failed line across %s ordering", (order) => {
    const previous = editedState();
    const next = order === "response-first"
      ? rebaseTrainingPlansEditorState(acknowledgeTrainingPlansSave(previous, result), [submittedA, b], "server-saved")
      : acknowledgeTrainingPlansSave(rebaseTrainingPlansEditorState(previous, [submittedA, b], "server-saved"), result);
    expect(next.plansByRiderId).toEqual({ a: submittedA, b: submittedB });
    expect(dirtyIds(next)).toEqual(["b"]);
  });
  it.each(["response-first", "server-tree-first"])("keeps edits made while saving across %s ordering", (order) => {
    const previous = editedState();
    previous.plansByRiderId.a = { ...submittedA, intensity: 90 };
    const next = order === "response-first"
      ? rebaseTrainingPlansEditorState(acknowledgeTrainingPlansSave(previous, result), [submittedA, b], "server-saved")
      : acknowledgeTrainingPlansSave(rebaseTrainingPlansEditorState(previous, [submittedA, b], "server-saved"), result);
    expect(next.plansByRiderId.a.intensity).toBe(90);
    expect(next.baselineByRiderId.a.intensity).toBe(65);
    expect(dirtyIds(next)).toEqual(["a", "b"]);
  });
  it("refreshes clean rows changed elsewhere without turning them into unsaved edits", () => {
    const previous = createTrainingPlansEditorState([a, b], "initial");
    const incoming = { ...a, intensity: 25 };
    const next = rebaseTrainingPlansEditorState(previous, [incoming, b], "server-changed");
    expect(next.plansByRiderId.a).toEqual(incoming);
    expect(dirtyIds(next)).toEqual([]);
  });
  it("incorporates a new rider and removes departed riders without resurrecting their drafts", () => {
    const c = { ...b, riderId: "c" };
    const next = rebaseTrainingPlansEditorState(editedState(), [b, c], "roster-changed");
    expect(next.plansByRiderId).toEqual({ b: submittedB, c });
    expect(dirtyIds(next)).toEqual(["b"]);
  });
  it("clears only a now-unavailable trainer while keeping the rest of an unsaved programme", () => {
    const previous = editedState();
    const next = rebaseTrainingPlansEditorState(previous, [{ ...a, trainerContractId: null }, b], "trainer-dismissed", []);
    expect(next.plansByRiderId.a).toEqual({ ...submittedA, trainerContractId: null });
    expect(next.plansByRiderId.b).toEqual(submittedB);
    expect(dirtyIds(next)).toEqual(["a", "b"]);
  });
});
