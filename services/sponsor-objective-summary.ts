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

type SponsorContractSatisfactionRow = {
  satisfaction_score: number;
  start_season_id: string;
  objective_season_id: string | null;
};

export async function getSponsorObjectiveSummary(contractId: string) {
  const normalizedContractId = contractId.trim();
  if (!normalizedContractId) {
    return summarizeSponsorObjectives([]);
  }

  const supabase = createSupabaseAdminClient();
  const contractResult = await supabase
    .from("team_sponsor_contracts")
    .select("satisfaction_score, start_season_id, objective_season_id")
    .eq("id", normalizedContractId)
    .maybeSingle<SponsorContractSatisfactionRow>();

  if (contractResult.error) {
    throw new Error(
      `Impossible de charger la satisfaction sponsor : ${contractResult.error.message}`,
    );
  }
  if (!contractResult.data) return summarizeSponsorObjectives([]);

  const objectiveSeasonId =
    contractResult.data.objective_season_id ?? contractResult.data.start_season_id;
  const { data, error } = await supabase
    .from("objective_progress")
    .select("sponsor_objective_id, status")
    .eq("team_sponsor_contract_id", normalizedContractId)
    .eq("season_id", objectiveSeasonId)
    .returns<ObjectiveProgressRow[]>();
  if (error) {
    throw new Error(
      `Impossible de charger le résumé des objectifs sponsor : ${error.message}`,
    );
  }

  const persistedSatisfactionScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(Number(contractResult.data?.satisfaction_score ?? 0)),
    ),
  );

  const progressRows = data ?? [];
  const objectiveIds = progressRows.map(
    (objective) => objective.sponsor_objective_id,
  );

  if (objectiveIds.length === 0) {
    return {
      ...summarizeSponsorObjectives([]),
      satisfactionScore: persistedSatisfactionScore,
    };
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

  return {
    ...summarizeSponsorObjectives(
      progressRows.map((objective) => ({
        status: objective.status,
        satisfactionPoints:
          weightByObjectiveId.get(objective.sponsor_objective_id) ?? 0,
      })),
    ),
    satisfactionScore: persistedSatisfactionScore,
  };
}
