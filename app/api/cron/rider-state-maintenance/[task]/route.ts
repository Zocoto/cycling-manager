import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import {
  getGameMaintenanceHealth,
  isGameMaintenanceTask,
  runGameMaintenanceTask,
} from "@/services/game-state-settlement";

export const maxDuration = 300;

type MaintenanceRouteContext = {
  params: Promise<{ task: string }>;
};

export async function GET(request: Request, context: MaintenanceRouteContext) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { task } = await context.params;
  if (task === "health-check") {
    const health = await getGameMaintenanceHealth();
    const log = health.healthy ? console.info : console.error;
    log("game_maintenance_health", health);
    return Response.json(health, { status: health.healthy ? 200 : 503 });
  }
  if (!isGameMaintenanceTask(task)) {
    return Response.json({ error: "Unknown maintenance task" }, { status: 404 });
  }

  const startedAt = Date.now();
  try {
    const result = await runGameMaintenanceTask(task);
    const payload = {
      event: "game_maintenance_task",
      task,
      ok: true,
      durationMs: Date.now() - startedAt,
      settledAt: new Date().toISOString(),
      result,
    };
    console.info("game_maintenance_task", payload);
    return Response.json(payload);
  } catch (error) {
    const payload = {
      event: "game_maintenance_task",
      task,
      ok: false,
      durationMs: Date.now() - startedAt,
      settledAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    console.error("game_maintenance_task", payload);
    return Response.json(payload, { status: 500 });
  }
}
