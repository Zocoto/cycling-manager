import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { redeemDailyRewardAction } from "./actions";
const inventoryId = "00000000-0000-4000-8000-000000000001", riderId = "00000000-0000-4000-8000-000000000002";
function data() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ inventoryId, riderId, quantity: "1", effectKind: "injury_care", returnPath: "/jeu/centre-de-soin?onglet=blessures" })) form.set(key, value);
  return form;
}
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { message: "12 h gagnées, 24 h de convalescence restantes." }, error: null }); });
describe("utilisation d’un soin depuis le centre", () => {
  it("uses the existing atomic RPC, refreshes both views and returns with the actual result", async () => {
    await expect(redeemDailyRewardAction(data())).rejects.toThrow('redirect:/jeu/centre-de-soin?onglet=blessures&succes=');
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("redeem_injury_care_reward", { p_inventory_id: inventoryId, p_rider_id: riderId });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/inventaire");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/centre-de-soin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/effectif");
  });
  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(redeemDailyRewardAction(data())).rejects.toThrow("redirect:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers before database work", async () => {
    const form = data(); form.set("riderId", "invalid");
    await expect(redeemDailyRewardAction(form)).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("shows stock/compatibility/ownership refusals without a success notice", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Cet objet de soin n’est plus disponible." } });
    await expect(redeemDailyRewardAction(data())).rejects.toThrow('redirect:/jeu/centre-de-soin?onglet=blessures&erreur=');
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["https://evil.invalid", "/jeu/centre-de-soin?onglet=blessures&redirect=evil", "//evil.invalid"])('does not broaden the return allowlist: %s', async returnPath => {
    const form = data(); form.set("returnPath", returnPath);
    await expect(redeemDailyRewardAction(form)).rejects.toThrow('redirect:/jeu/objectifs?onglet=quotidiennes&succes=');
  });
  it("preserves inventory navigation", async () => {
    const form = data(); form.set("returnPath", "/jeu/inventaire?categorie=injury_care");
    await expect(redeemDailyRewardAction(form)).rejects.toThrow('redirect:/jeu/inventaire?categorie=injury_care&succes=');
  });
});
