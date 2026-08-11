import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";

export const maxDuration = 300;

const MAINTENANCE_TASKS = [
  "settle_due_training_sessions",
  "settle_due_infrastructure_projects",
  "settle_due_elite_wildcards",
  "settle_due_staff_academy_trainings",
  "settle_due_season_rollovers",
] as const;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settledAt = new Date().toISOString();
  const results = [];
  for (const task of MAINTENANCE_TASKS) {
    const result = await admin.rpc(task);
    results.push({
      task,
      ok: !result.error,
      error: result.error?.message ?? null,
    });
    if (result.error) break;
  }
  const failedTasks = results.filter((result) => !result.ok);

  return Response.json(
    { settledAt, results },
    { status: failedTasks.length > 0 ? 500 : 200 },
  );
}
