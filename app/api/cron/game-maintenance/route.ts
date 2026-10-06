import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { pruneChatImages } from "@/services/chat-image-maintenance";

export const maxDuration = 300;

const MAINTENANCE_TASKS = [
  "settle_due_infrastructure_projects",
  "settle_due_elite_wildcards",
  "sync_junior_pro_national_fallback",
  "settle_due_lightweight_junior_national_championships",
  "settle_due_development_races",
  "settle_due_season_rollovers",
  "refresh_due_rider_favorite_races",
  "settle_due_rider_morale",
  "settle_due_youth_rider_morale",
  "settle_due_federation_elections",
  "initialize_due_federation_presidencies",
  "settle_due_exceptional_federation_elections",
  "settle_due_national_federation_hosting_candidacies",
  "ensure_due_professional_nations_cup",
  "freeze_due_international_nation_qualifications",
  "prepare_due_automatic_federation_junior_lineups",
  "activate_due_national_federation_jerseys",
  "initialize_due_national_federation_accounts",
  "sync_due_national_federation_championship_lineups",
  "settle_due_national_federation_infrastructure_projects",
  "settle_due_national_federation_school_plans",
  "settle_due_national_federation_hosting_returns",
  "settle_due_national_federation_race_votes",
  "settle_due_national_federation_race_maintenance",
  "purge_expired_director_messages",
] as const;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settledAt = new Date().toISOString();
  const results: { task: string; ok: boolean; error: string | null; durationMs: number }[] = [];
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
  const imageCleanupStartedAt = Date.now();
  try {
    await pruneChatImages(admin);
    results.push({ task: "prune_global_chat_images", ok: true, error: null, durationMs: Date.now() - imageCleanupStartedAt });
  } catch (error) {
    console.error("chat_image_cleanup_failed", error);
    results.push({ task: "prune_global_chat_images", ok: false, error: "Nettoyage des images indisponible", durationMs: Date.now() - imageCleanupStartedAt });
  }
  const failedTasks = results.filter((result) => !result.ok);

  return Response.json(
    { settledAt, results },
    { status: failedTasks.length > 0 ? 500 : 200 },
  );
}
