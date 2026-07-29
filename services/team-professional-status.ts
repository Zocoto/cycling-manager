import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActiveSponsorContractRow = {
  team_id: string;
};

export async function getActivelySponsoredTeamIds(
  teamIds: readonly string[]
): Promise<Set<string>> {
  const normalizedTeamIds = [
    ...new Set(teamIds.map((teamId) => teamId.trim()).filter(Boolean)),
  ];

  if (normalizedTeamIds.length === 0) {
    return new Set();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_sponsor_contracts")
    .select("team_id")
    .in("team_id", normalizedTeamIds)
    .eq("role", "principal")
    .eq("status", "active")
    .returns<ActiveSponsorContractRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le statut professionnel des équipes : ${error.message}`
    );
  }

  return new Set((data ?? []).map((contract) => contract.team_id));
}