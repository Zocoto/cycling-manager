import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";

export const maxDuration = 300;

const MAINTENANCE_TASKS = [
  "settle_due_infrastructure_projects",
  "settle_due_elite_wildcards",
  "sync_junior_pro_national_fallback",
  "settle_due_development_races",
  "settle_due_season_rollovers",
  "settle_due_federation_elections",
  "settle_due_national_federation_hosting_candidacies",
  "prepare_due_automatic_federation_junior_lineups",
  "activate_due_national_federation_jerseys",
  "initialize_due_national_federation_accounts",
  "sync_due_national_federation_championship_lineups",
  "settle_due_national_federation_infrastructure_projects",
  "settle_due_national_federation_hosting_returns",
  "purge_expired_director_messages",
] as const;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settledAt = new Date().toISOString();
  const results = [];
  for (const task of MAINTENANCE_TASKS) {
    const startedAt = Date.now();
    const result = await admin.rpc(task);
    const taskResult = {
      task,
      ok: !result.error,
      error: result.error?.message ?? null,
      durationMs: Date.now() - startedAt,
    };
    results.push(taskResult);
    const log = taskResult.ok ? console.info : console.error;
    log("game_maintenance_fallback_task", taskResult);
  }
  const failedTasks = results.filter((result) => !result.ok);

  return Response.json(
    { settledAt, results },
    { status: failedTasks.length > 0 ? 500 : 200 },
  );
}
