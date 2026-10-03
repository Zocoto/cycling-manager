import { describe, expect, it, vi } from "vitest";

import { getCurrentTeamRacePreparation } from "@/services/race-calendar";

type PreparationClient = Parameters<typeof getCurrentTeamRacePreparation>[0];

function preparationRow(index: number, editionId = "past-edition") {
  return {
    race_edition_id: editionId,
    race_registration_id: `registration-${editionId}`,
    team_id: "current-team",
    stage_id: `stage-${editionId}-${Math.floor(index / 8)}`,
    rider_id: `rider-${index % 8}`,
    rider_first_name: "Test",
    rider_last_name: `Rider ${index % 8}`,
    mountain: 70,
    hills: 71,
    flat: 72,
    time_trial: 73,
    cobbles: 74,
    sprint: 75,
    acceleration: 76,
    downhill: 77,
    endurance: 78,
    resistance: 79,
    recovery: 80,
    breakaway: 81,
    prologue: 82,
    general_role: "leader",
    stage_role: "leader",
    time_trial_effort: "balanced",
    relay_share_pct: 25,
    time_trial_updated_at: "2026-10-02T10:00:00Z",
    objective: "balanced",
    collective_posture: "balanced",
    breakaway_policy: "opportunistic",
    chase_policy: "dangerous_breakaway",
    lieutenant_rider_id: null,
    danger_pacer_rider_id: null,
    protector_rider_id: null,
    breakaway_rider_id: null,
    attack_orders: [],
    strategy_updated_at: "2026-10-02T10:00:00Z",
  };
}

function preparationClient(
  rows: ReturnType<typeof preparationRow>[],
  failingOffset?: number,
) {
  const range = vi.fn(async (from: number, to: number) =>
    from === failingOffset
      ? { data: null, error: { message: "Second page unavailable" } }
      : { data: rows.slice(from, to + 1), error: null },
  );
  const query = { order: vi.fn(), range };
  query.order.mockReturnValue(query);
  const rpc = vi.fn(() => query);
  return { client: { rpc } as unknown as PreparationClient, rpc, range, query };
}

describe("team race preparation pagination", () => {
  it("recovers upcoming races beyond the 1,000-row response cap", async () => {
    // Matches the reported season: 1,241 rows, first future row at 1,015.
    const rows = Array.from({ length: 1241 }, (_, index) =>
      preparationRow(index, index < 1014 ? "past-edition" : "future-edition"),
    );
    const { client, rpc, range, query } = preparationClient(rows);

    const plans = await getCurrentTeamRacePreparation(client);

    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("get_current_team_race_preparation");
    expect(query.order.mock.calls.slice(0, 4)).toEqual([
      ["race_edition_id", { ascending: true }],
      ["race_registration_id", { ascending: true }],
      ["stage_id", { ascending: true }],
      ["rider_id", { ascending: true }],
    ]);
    const future = plans.find((plan) => plan.editionId === "future-edition")!;
    expect(future).toBeDefined();
    expect(future.riders).toHaveLength(8);
    expect(Object.keys(future.stages)).toHaveLength(30);
    expect(future.riders[0].ratings.hills).toBe(71);
    expect(future.riders[0].generalRole).toBe("leader");
    expect(Object.values(future.stages)[0].updatedAt).toBe("2026-10-02T10:00:00Z");

    const past = plans.find((plan) => plan.editionId === "past-edition")!;
    // A stage can straddle the page boundary: no riders/roles may be lost.
    expect(past.riders).toHaveLength(8);
    expect(Object.keys(past.stages)).toHaveLength(127);
    expect(past.riders[0].stageRoles["stage-past-edition-125"]).toBe("leader");
    expect(past.riders[0].timeTrialPlans["stage-past-edition-125"].relaySharePct).toBe(25);
  });

  it("keeps a small roster to a single read-only RPC", async () => {
    const { client, rpc, range } = preparationClient(
      Array.from({ length: 8 }, (_, index) => preparationRow(index)),
    );
    const plans = await getCurrentTeamRacePreparation(client);
    expect(plans).toHaveLength(1);
    expect(plans[0].riders).toHaveLength(8);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(range.mock.calls).toEqual([[0, 999]]);
  });

  it("reads the terminal page when the response is exactly full", async () => {
    const { client, range } = preparationClient(
      Array.from({ length: 1000 }, (_, index) => preparationRow(index)),
    );
    await getCurrentTeamRacePreparation(client);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("rejects a later-page failure instead of showing a misleading partial plan", async () => {
    const { client, range } = preparationClient(
      Array.from({ length: 1241 }, (_, index) => preparationRow(index)),
      1000,
    );
    await expect(getCurrentTeamRacePreparation(client)).rejects.toThrow(
      "Impossible de charger la préparation des courses : Second page unavailable",
    );
    expect(range).toHaveBeenCalledTimes(2);
  });

  it("preserves the empty state when the team genuinely has no registrations", async () => {
    const { client, rpc } = preparationClient([]);
    expect(await getCurrentTeamRacePreparation(client)).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
