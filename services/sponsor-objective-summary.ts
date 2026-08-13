import "server-only";

import { summarizeSponsorObjectives } from "@/lib/game/sponsor-objective-summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ObjectiveProgressRow = {
  sponsor_objective_id: string;
  status: string;
};

type SponsorObjectiveWeightRow = {
  id: string;
  satisfaction_points: number;
};

export async function getSponsorObjectiveSummary(contractId: string) {
  const normalizedContractId = contractId.trim();
  if (!normalizedContractId) {
    return summarizeSponsorObjectives([]);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("objective_progress")
    .select("sponsor_objective_id, status")
    .eq("team_sponsor_contract_id", normalizedContractId)
    .returns<ObjectiveProgressRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le résumé des objectifs sponsor : ${error.message}`,
    );
  }

  const progressRows = data ?? [];
  const objectiveIds = progressRows.map(
    (objective) => objective.sponsor_objective_id,
  );

  if (objectiveIds.length === 0) {
    return summarizeSponsorObjectives([]);
  }

  const { data: weightRows, error: weightError } = await supabase
    .from("sponsor_objectives")
    .select("id, satisfaction_points")
    .in("id", objectiveIds)
    .returns<SponsorObjectiveWeightRow[]>();

  if (weightError) {
    throw new Error(
      `Impossible de charger les poids de satisfaction sponsor : ${weightError.message}`,
    );
  }

  const weightByObjectiveId = new Map(
    (weightRows ?? []).map((objective) => [
      objective.id,
      Number(objective.satisfaction_points),
    ]),
  );

  return summarizeSponsorObjectives(
    progressRows.map((objective) => ({
      status: objective.status,
      satisfactionPoints:
        weightByObjectiveId.get(objective.sponsor_objective_id) ?? 0,
    })),
  );
}
