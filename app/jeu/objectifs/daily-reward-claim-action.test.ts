import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import { claimDailyRewardAction } from "./actions";

function claim(rewardKey: string) {
  const form = new FormData();
  form.set("rewardKey", rewardKey);
  return claimDailyRewardAction(form);
}

describe("claimDailyRewardAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
  });

  it.each(["morale_boost_5", "morale_boost_10", "energy-ration"])(
    "passes catalog key %s through to the claim RPC",
    async (rewardKey) => {
      await expect(claim(rewardKey)).rejects.toThrow(
        "redirect:/jeu/objectifs?onglet=quotidiennes&succes=",
      );
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_current_daily_reward", {
        p_reward_key: rewardKey,
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/inventaire");
    },
  );

  it("rejects malformed keys before requesting a claim", async () => {
    await expect(claim("morale_boost/5")).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("shows the refusal when the item is outside the player's daily offer", async () => {
    const message = "Ce cadeau ne fait pas partie des offres du jour.";
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message } });
    await expect(claim("morale_boost_5")).rejects.toThrow(
      new URLSearchParams({ erreur: message }).toString(),
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
