import "server-only";

import { summarizeSponsorObjectiveStatuses } from "@/lib/game/sponsor-objective-summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ObjectiveProgressRow = {
  status: string;
};

export async function getSponsorObjectiveSummary(contractId: string) {
  const normalizedContractId = contractId.trim();
  if (!normalizedContractId) {
    return summarizeSponsorObjectiveStatuses([]);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("objective_progress")
    .select("status")
    .eq("team_sponsor_contract_id", normalizedContractId)
    .returns<ObjectiveProgressRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le résumé des objectifs sponsor : ${error.message}`,
    );
  }

  return summarizeSponsorObjectiveStatuses(
    (data ?? []).map((objective) => objective.status),
  );
}
