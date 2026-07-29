import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.returns = vi.fn();

  return {
    chain,
    from: vi.fn(() => chain),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { getActivelySponsoredTeamIds } from "@/services/team-professional-status";

describe("getActivelySponsoredTeamIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chain.returns.mockResolvedValue({
      data: [{ team_id: "team-active" }],
      error: null,
    });
  });

  it("ne retient que les sponsors principaux dont le contrat est actif", async () => {
    const result = await getActivelySponsoredTeamIds([
      " team-active ",
      "team-active",
      "team-planned",
    ]);

    expect(mocks.from).toHaveBeenCalledWith("team_sponsor_contracts");
    expect(mocks.chain.in).toHaveBeenCalledWith("team_id", [
      "team-active",
      "team-planned",
    ]);
    expect(mocks.chain.eq).toHaveBeenCalledWith("role", "principal");
    expect(mocks.chain.eq).toHaveBeenCalledWith("status", "active");
    expect([...result]).toEqual(["team-active"]);
  });

  it("n’interroge pas la base sans équipe", async () => {
    await expect(getActivelySponsoredTeamIds([])).resolves.toEqual(new Set());
    expect(mocks.from).not.toHaveBeenCalled();
  });
});