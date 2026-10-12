import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
}) }));
import { updateFanClubAutoRestockAction } from "./actions";

describe("réglages du réapprovisionnement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });
  it("enregistre les seuils et les deux options pour le joueur authentifié", async () => {
    const result = await updateFanClubAutoRestockAction({ enabled: true, allowNegativeProjection: false,
      minimumStocks: { "team-jersey": 120, bottle: 0 } });
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("set_current_team_fan_club_auto_restock", {
      p_enabled: true, p_allow_negative_projection: false, p_minimum_stocks: { "team-jersey": 120, bottle: 0 },
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/fan-club");
  });
  it("rejette les produits inconnus et les seuils négatifs ou fractionnaires", async () => {
    const invalidStocks: Record<string, number>[] = [{ unknown: 10 }, { bottle: -1 }, { bottle: 1.5 }, { bottle: 5001 }];
    for (const minimumStocks of invalidStocks) {
      expect((await updateFanClubAutoRestockAction({ enabled: true, allowNegativeProjection: false, minimumStocks })).ok).toBe(false);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ne modifie rien sans session et transmet les erreurs de capacité", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const settings = { enabled: false, allowNegativeProjection: true, minimumStocks: {} };
    expect((await updateFanClubAutoRestockAction(settings)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Les minimums cumulés dépassent la capacité du magasin." } });
    expect(await updateFanClubAutoRestockAction(settings)).toEqual({ ok: false,
      message: "Les minimums cumulés dépassent la capacité du magasin." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
