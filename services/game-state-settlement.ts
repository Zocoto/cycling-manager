import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { settleDueYouthAutomaticTrainingSessions } from "@/services/youth-development";

export const GAME_MAINTENANCE_TASKS = [
  "training",
  "health",
  "staff-academy",
  "infrastructure",
  "equipment",
  "elite-wildcards",
  "development",
] as const;

export type GameMaintenanceTask = (typeof GAME_MAINTENANCE_TASKS)[number];

type MaintenanceRunRow = {
  task_key: string;
  status: "idle" | "running" | "succeeded" | "failed";
  last_started_at: string | null;
  last_succeeded_at: string | null;
  last_failed_at: string | null;
  last_duration_ms: number | null;
  last_error: string | null;
};

export type GameMaintenanceHealth = {
  checkedAt: string;
  healthy: boolean;
  tasks: Array<{
    task: GameMaintenanceTask;
    status: MaintenanceRunRow["status"] | "missing";
    lastStartedAt: string | null;
    lastSucceededAt: string | null;
    lastFailedAt: string | null;
    durationMs: number | null;
    stale: boolean;
    error: string | null;
  }>;
};

const MAINTENANCE_STALE_AFTER_MS = 45 * 60 * 1_000;

export function isGameMaintenanceTask(value: string): value is GameMaintenanceTask {
  return (GAME_MAINTENANCE_TASKS as readonly string[]).includes(value);
}

export async function runGameMaintenanceTask(
  task: GameMaintenanceTask,
): Promise<unknown> {
  const admin = createSupabaseAdminClient();
  const startedAt = new Date();
  const startedIso = startedAt.toISOString();
  const started = await admin.from("game_maintenance_runs").upsert(
    {
      task_key: task,
      status: "running",
      last_started_at: startedIso,
      last_error: null,
      updated_at: startedIso,
    },
    { onConflict: "task_key" },
  );
  assertSettlement(started.error, `le suivi de maintenance « ${task} »`);

  const result = await admin.rpc("run_game_maintenance_task", {
    p_task_key: task,
  });

  if (result.error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await admin
      .from("game_maintenance_runs")
      .update({
        status: "failed",
        last_failed_at: finishedAt.toISOString(),
        last_duration_ms: durationMs,
        last_error: result.error.message.slice(0, 2_000),
        updated_at: finishedAt.toISOString(),
      })
      .eq("task_key", task);
    assertSettlement(result.error, `la maintenance « ${task} »`);
  }

  let resolvedResult: unknown = result.data;
  try {
    if (task === "training") {
      const youthTraining = await settleDueYouthAutomaticTrainingSessions();
      resolvedResult = {
        ...(isRecord(result.data) ? result.data : {}),
        youth_training: youthTraining,
      };
    } else if (task === "elite-wildcards") {
      // Ce traitement reste hors des parcours interactifs : il profite du
      // passage de maintenance déjà planifié après les clôtures d'inscription.
      const detectionTeams = await admin.rpc(
        "settle_due_free_agent_detection_teams",
        { p_now: new Date().toISOString() },
      );
      assertSettlement(
        detectionTeams.error,
        "les équipes de détection d’agents libres",
      );
      resolvedResult = {
        ...(isRecord(result.data) ? result.data : {}),
        detection_teams: detectionTeams.data,
      };
    }
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("game_maintenance_runs")
      .update({
        status: "failed",
        last_failed_at: finishedAt.toISOString(),
        last_duration_ms: durationMs,
        last_error: message.slice(0, 2_000),
        updated_at: finishedAt.toISOString(),
      })
      .eq("task_key", task);
    throw error;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const completed = await admin
    .from("game_maintenance_runs")
    .update({
      status: "succeeded",
      last_succeeded_at: finishedAt.toISOString(),
      last_duration_ms: durationMs,
      last_error: null,
      updated_at: finishedAt.toISOString(),
    })
    .eq("task_key", task);
  assertSettlement(completed.error, `le suivi de maintenance « ${task} »`);

  return resolvedResult;
}

export async function getGameMaintenanceHealth(
  now = new Date(),
): Promise<GameMaintenanceHealth> {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("game_maintenance_runs")
    .select(
      "task_key, status, last_started_at, last_succeeded_at, last_failed_at, last_duration_ms, last_error",
    )
    .in("task_key", [...GAME_MAINTENANCE_TASKS])
    .returns<MaintenanceRunRow[]>();
  assertSettlement(result.error, "l’état des maintenances");

  const rowsByTask = new Map(
    (result.data ?? []).map((row) => [row.task_key, row]),
  );
  const tasks: GameMaintenanceHealth["tasks"] = GAME_MAINTENANCE_TASKS.map((task) => {
    const row = rowsByTask.get(task);
    const lastSucceededAt = row?.last_succeeded_at ?? null;
    const stale =
      !lastSucceededAt ||
      now.getTime() - new Date(lastSucceededAt).getTime() >
        MAINTENANCE_STALE_AFTER_MS;

    return {
      task,
      status: row?.status ?? "missing",
      lastStartedAt: row?.last_started_at ?? null,
      lastSucceededAt,
      lastFailedAt: row?.last_failed_at ?? null,
      durationMs: row?.last_duration_ms ?? null,
      stale,
      error: row?.last_error ?? null,
    };
  });

  return {
    checkedAt: now.toISOString(),
    healthy: tasks.every(
      (task) => task.status === "succeeded" && !task.stale,
    ),
    tasks,
  };
}

function assertSettlement(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible d’actualiser ${resource} : ${error.message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
