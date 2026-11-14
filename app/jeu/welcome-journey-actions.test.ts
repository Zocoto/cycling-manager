import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  }),
}));

import { recordNewcomerReplayStartAction } from "./welcome-journey-actions";

const stageId = "d291371c-56f6-4a6c-b9f7-0d5c4b1ee5f1";

describe("recordNewcomerReplayStartAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "authenticated-director" } },
      error: null,
    });
  });

  it("refreshes the welcome objective only when playback newly completes it", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    expect(await recordNewcomerReplayStartAction(stageId)).toBe(true);
    expect(await recordNewcomerReplayStartAction(stageId)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("record_current_newcomer_replay_visit", {
      p_stage_id: stageId,
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/jeu"], ["/jeu/objectifs"]]);
  });

  it("rejects an invalid stage ID or missing session before calling the database", async () => {
    expect(await recordNewcomerReplayStartAction("preview")).toBe(false);
    expect(mocks.getClaims).not.toHaveBeenCalled();
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await recordNewcomerReplayStartAction(stageId)).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
