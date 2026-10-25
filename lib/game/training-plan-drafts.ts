import type { TrainingDomain } from "@/lib/game/training";

export type TrainingPlanDraft = {
  riderId: string;
  intensity: number;
  domain: TrainingDomain;
  trainerContractId: string | null;
};

export function getChangedTrainingPlanIds(
  initialPlans: readonly TrainingPlanDraft[],
  currentPlans: readonly TrainingPlanDraft[],
): string[] {
  const initialByRiderId = new Map(
    initialPlans.map((plan) => [plan.riderId, plan]),
  );

  return currentPlans.flatMap((plan) => {
    const initialPlan = initialByRiderId.get(plan.riderId);
    if (!initialPlan || !areTrainingPlansEqual(initialPlan, plan)) {
      return [plan.riderId];
    }
    return [];
  });
}

export function countTrainingPlansByTrainer(
  plans: readonly TrainingPlanDraft[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const plan of plans) {
    if (!plan.trainerContractId) continue;
    counts[plan.trainerContractId] =
      (counts[plan.trainerContractId] ?? 0) + 1;
  }
  return counts;
}

export function areTrainingPlansEqual(
  left: TrainingPlanDraft,
  right: TrainingPlanDraft,
) {
  return (
    left.intensity === right.intensity &&
    left.domain === right.domain &&
    left.trainerContractId === right.trainerContractId
  );
}

/** An unavailable trainer must never remain hidden behind “Sans entraîneur”. */
export function normalizeTrainingPlanTrainers(
  plans: readonly TrainingPlanDraft[],
  trainerIds?: readonly string[],
): TrainingPlanDraft[] {
  if (!trainerIds) return plans.map((plan) => ({ ...plan }));
  const activeTrainerIds = new Set(trainerIds);
  return plans.map((plan) => ({
    ...plan,
    trainerContractId: plan.trainerContractId && activeTrainerIds.has(plan.trainerContractId)
      ? plan.trainerContractId
      : null,
  }));
}
