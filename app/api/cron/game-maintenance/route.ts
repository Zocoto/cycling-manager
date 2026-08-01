import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";

export const maxDuration = 60;

const MAINTENANCE_TASKS = [
  "settle_due_training_sessions",
  "settle_due_infrastructure_projects",
  "settle_due_elite_wildcards",
] as const;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settledAt = new Date().toISOString();
  const results = await Promise.all(
    MAINTENANCE_TASKS.map(async (task) => {
      const result = await admin.rpc(task);
      return {
        task,
        ok: !result.error,
        error: result.error?.message ?? null,
      };
    }),
  );
  const failedTasks = results.filter((result) => !result.ok);

  return Response.json(
    { settledAt, results },
    { status: failedTasks.length > 0 ? 500 : 200 },
  );
}
