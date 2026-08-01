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

function areTrainingPlansEqual(
  left: TrainingPlanDraft,
  right: TrainingPlanDraft,
) {
  return (
    left.intensity === right.intensity &&
    left.domain === right.domain &&
    left.trainerContractId === right.trainerContractId
  );
}
