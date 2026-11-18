import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type DetectionSettlementRow = {
  processed_editions: number;
  created_teams: number;
  selected_riders: number;
  skipped_without_managed_team: number;
  editions_with_insufficient_pool: number;
};

export async function settleDueFreeAgentDetectionTeams(admin: Admin, now: Date) {
  const { data, error } = await admin.rpc("get_due_free_agent_detection_edition_ids", {
    p_now: now.toISOString(),
  }).abortSignal(AbortSignal.timeout(9500));
  if (error) throw new Error(error.message);

  const queue = (data ?? []) as Array<{ race_edition_id: string }>;
  return settleFreeAgentDetectionForEditions(admin, queue.map((row) => row.race_edition_id), now);
}

export async function settleFreeAgentDetectionForEditions(
  admin: Admin,
  editionIds: readonly string[],
  now: Date,
) {
  const totals = {
    processedEditions: 0,
    createdTeams: 0,
    selectedRiders: 0,
    skippedWithoutManagedTeam: 0,
    editionsWithInsufficientPool: 0,
    insufficientPoolEditionIds: [] as string[],
    failedEditionIds: [] as string[],
  };
  // Keep registrations in separate transactions. Sequential processing also
  // gives an earlier departure first choice of available, conflict-free riders.
  for (const editionId of new Set(editionIds)) {
    try {
      const settleEdition = () => admin.rpc("settle_free_agent_detection_teams_for_editions", {
        p_edition_ids: [editionId],
        p_now: now.toISOString(),
      }).abortSignal(AbortSignal.timeout(9500));
      let result = await settleEdition();
      if (result.error?.code === "55P03") result = await settleEdition();
      const { data, error } = result;
      if (error) throw new Error(error.message);
      const row = (data as DetectionSettlementRow[] | null)?.[0];
      if (!row) throw new Error("Missing detection settlement receipt");

      totals.processedEditions += row.processed_editions;
      totals.createdTeams += row.created_teams;
      totals.selectedRiders += row.selected_riders;
      totals.skippedWithoutManagedTeam += row.skipped_without_managed_team;
      totals.editionsWithInsufficientPool += row.editions_with_insufficient_pool;
      if (row.editions_with_insufficient_pool > 0) totals.insufficientPoolEditionIds.push(editionId);
    } catch (error) {
      totals.failedEditionIds.push(editionId);
      console.error("free_agent_detection_edition_failed", {
        editionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return totals;
}
