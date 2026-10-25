import {
  areTrainingPlansEqual,
  normalizeTrainingPlanTrainers,
  type TrainingPlanDraft,
} from "@/lib/game/training-plan-drafts";

export type TrainingPlansSaveState = {
  status: "idle" | "success" | "partial" | "error";
  message: string | null;
  savedPlans: TrainingPlanDraft[];
  failures: Array<{ riderId: string; message: string; code?: string }>;
  effectiveDay?: number;
  /** Values actually sent, before any server-side stale-trainer reset. */
  submittedPlans?: TrainingPlanDraft[];
};

export const INITIAL_TRAINING_PLANS_SAVE_STATE: TrainingPlansSaveState = {
  status: "idle",
  message: null,
  savedPlans: [],
  failures: [],
};

export type TrainingPlansEditorState = {
  serverRevision: string;
  baselineByRiderId: Record<string, TrainingPlanDraft>;
  plansByRiderId: Record<string, TrainingPlanDraft>;
};

export function createTrainingPlansEditorState(
  plans: readonly TrainingPlanDraft[],
  serverRevision: string,
): TrainingPlansEditorState {
  const baselineByRiderId = indexPlans(plans);
  return { serverRevision, baselineByRiderId, plansByRiderId: { ...baselineByRiderId } };
}

/** Revalidation may refresh the roster without erasing edits not yet saved. */
export function rebaseTrainingPlansEditorState(
  state: TrainingPlansEditorState,
  serverPlans: readonly TrainingPlanDraft[],
  serverRevision: string,
  trainerIds?: readonly string[],
): TrainingPlansEditorState {
  const baselineByRiderId = indexPlans(serverPlans);
  const plansByRiderId = indexPlans(normalizeTrainingPlanTrainers(serverPlans.map((plan) => {
    const previousBaseline = state.baselineByRiderId[plan.riderId];
    const current = state.plansByRiderId[plan.riderId];
    return previousBaseline && current && !areTrainingPlansEqual(previousBaseline, current)
      ? current
      : plan;
  }), trainerIds));
  return { serverRevision, baselineByRiderId, plansByRiderId };
}

/** Acknowledge only saved rows, and never swallow an edit made during the request. */
export function acknowledgeTrainingPlansSave(
  state: TrainingPlansEditorState,
  result: TrainingPlansSaveState,
): TrainingPlansEditorState {
  if (!result.savedPlans.length) return state;
  const submittedByRiderId = indexPlans(result.submittedPlans ?? result.savedPlans);
  const baselineByRiderId = { ...state.baselineByRiderId };
  const plansByRiderId = { ...state.plansByRiderId };
  for (const saved of result.savedPlans) {
    const current = plansByRiderId[saved.riderId];
    if (!current || !Object.hasOwn(baselineByRiderId, saved.riderId)) continue;
    baselineByRiderId[saved.riderId] = saved;
    const submitted = submittedByRiderId[saved.riderId];
    if (submitted && areTrainingPlansEqual(current, submitted)) {
      plansByRiderId[saved.riderId] = saved;
    }
  }
  return { ...state, baselineByRiderId, plansByRiderId };
}

function indexPlans(plans: readonly TrainingPlanDraft[]) {
  return Object.fromEntries(plans.map((plan) => [plan.riderId, plan]));
}
