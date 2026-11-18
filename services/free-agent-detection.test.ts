import { afterEach, describe, expect, it, vi } from "vitest";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { settleDueFreeAgentDetectionTeams, settleFreeAgentDetectionForEditions } from "./free-agent-detection";

const now = new Date("2026-11-18T07:00:00Z");

function createAdmin() {
  const abortSignal = vi.fn();
  const rpc = vi.fn().mockReturnValue({ abortSignal });
  return { admin: { rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>, rpc, abortSignal };
}

function settlement(created: number, insufficient = 0) {
  return {
    data: [{
      processed_editions: 1,
      created_teams: created,
      selected_riders: created * 5,
      skipped_without_managed_team: 0,
      editions_with_insufficient_pool: insufficient,
    }],
    error: null,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("detection team settlement", () => {
  it("processes distinct editions separately and continues after a database timeout", async () => {
    const { admin, rpc, abortSignal } = createAdmin();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    abortSignal
      .mockResolvedValueOnce({ data: null, error: { message: "statement timeout" } })
      .mockResolvedValueOnce(settlement(2, 1))
      .mockResolvedValueOnce(settlement(4));

    const result = await settleFreeAgentDetectionForEditions(admin, ["first", "second", "second", "third"], now);

    expect(rpc.mock.calls).toEqual(["first", "second", "third"].map((id) => [
      "settle_free_agent_detection_teams_for_editions",
      { p_edition_ids: [id], p_now: now.toISOString() },
    ]));
    expect(result).toMatchObject({
      processedEditions: 2,
      createdTeams: 6,
      selectedRiders: 30,
      failedEditionIds: ["first"],
      insufficientPoolEditionIds: ["second"],
    });
    expect(errorLog).toHaveBeenCalledOnce();
  });

  it("does not run a write when the maintenance queue is empty", async () => {
    const { admin, rpc, abortSignal } = createAdmin();
    abortSignal.mockResolvedValueOnce({ data: [], error: null });

    await expect(settleDueFreeAgentDetectionTeams(admin, now)).resolves.toMatchObject({ processedEditions: 0 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_due_free_agent_detection_edition_ids", { p_now: now.toISOString() });
  });

  it("retries once when another worker holds the edition lock", async () => {
    const { admin, rpc, abortSignal } = createAdmin();
    abortSignal
      .mockResolvedValueOnce({ data: null, error: { code: "55P03", message: "lock timeout" } })
      .mockResolvedValueOnce(settlement(4));

    await expect(settleFreeAgentDetectionForEditions(admin, ["one"], now)).resolves.toMatchObject({
      createdTeams: 4,
      failedEditionIds: [],
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("uses only the IDs in the due queue", async () => {
    const { admin, rpc, abortSignal } = createAdmin();
    abortSignal
      .mockResolvedValueOnce({ data: [{ race_edition_id: "one" }], error: null })
      .mockResolvedValueOnce(settlement(4));

    await expect(settleDueFreeAgentDetectionTeams(admin, now)).resolves.toMatchObject({ processedEditions: 1, createdTeams: 4 });
    expect(rpc).toHaveBeenNthCalledWith(2, "settle_free_agent_detection_teams_for_editions", {
      p_edition_ids: ["one"], p_now: now.toISOString(),
    });
  });
});
