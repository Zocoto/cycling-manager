import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, select, admin } = vi.hoisted(() => {
  const rpc = vi.fn();
  const select = vi.fn();
  return { rpc, select, admin: { from: () => ({ select }), rpc } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/services/youth-development", () => ({ settleDueYouthAutomaticTrainingSessions: vi.fn() }));

import { GAME_MAINTENANCE_TASKS, getGameMaintenanceHealth } from "./game-state-settlement";

describe("season rollover maintenance health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue({ in: () => ({ returns: async () => ({ error: null, data:
      GAME_MAINTENANCE_TASKS.map(task => ({ task_key: task, status: "succeeded",
        last_succeeded_at: "2026-10-09T06:00:00Z" }))
    }) }) });
    rpc.mockResolvedValue({ error: null, data: { healthy: true, activeSeasonCount: 1,
      overdueSeasonCount: 0, missingSettlementCount: 0, scheduledJobCount: 1 } });
  });

  it("accepts an opened season with a durable receipt and an active clock", async () => {
    const health = await getGameMaintenanceHealth(new Date("2026-10-09T06:10:00Z"));
    expect(health.healthy).toBe(true);
    expect(rpc).toHaveBeenCalledWith("get_season_rollover_health");
  });
  it("rejects a missed rollover even when every other maintenance succeeded", async () => {
    rpc.mockResolvedValue({ error: null, data: { healthy: false, activeSeasonCount: 1,
      overdueSeasonCount: 1, missingSettlementCount: 0, scheduledJobCount: 1 } });
    const health = await getGameMaintenanceHealth(new Date("2026-10-09T06:10:00Z"));
    expect(health.healthy).toBe(false);
    expect(health.seasonRollover.overdueSeasonCount).toBe(1);
  });
  it("fails closed when the database check is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const health = await getGameMaintenanceHealth(new Date("2026-10-09T06:10:00Z"));
    expect(health.healthy).toBe(false);
    expect(health.seasonRollover.error).toBe("unavailable");
  });
});
