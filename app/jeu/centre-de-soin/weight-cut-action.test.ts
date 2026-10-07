import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyWeightCutAction } from "./actions";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

const riderId = "00000000-0000-4000-8000-000000000001";
function payload(loss: string, rider = riderId) {
  const data = new FormData();
  data.set("riderId", rider);
  data.set("weightLossKg", loss);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "authenticated-director" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: "weight-event", error: null });
});

describe("weight-cut action", () => {
  it.each(["0.2", "0.4", "0.6", "0.8", "1"])("sends only the selected rider and %s kg to the authenticated weight-cut RPC", async (loss) => {
    await expect(applyWeightCutAction(payload(loss))).rejects.toThrow("redirect:/jeu/centre-de-soin?onglet=nutrition&affutage=confirme");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("apply_current_team_weight_cut", {
      p_rider_id: riderId, p_weight_loss_kg: Number(loss),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/centre-de-soin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/coureurs/[identifiant]", "page");
  });

  it.each(["", "0", "0.3", "1.2", "NaN", "Infinity"])("rejects invalid %s kg before calling the database", async (loss) => {
    await expect(applyWeightCutAction(payload(loss))).rejects.toThrow("redirect:/jeu/centre-de-soin?onglet=nutrition&erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not submit a missing or foreign-format rider identifier", async () => {
    await expect(applyWeightCutAction(payload("0.2", "invalid"))).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a logged-in DS", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(applyWeightCutAction(payload("0.2"))).rejects.toThrow("redirect:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    "Un programme d’affûtage ne peut être réalisé que tous les cinq jours.",
    "La forme du coureur est insuffisante pour ce programme.",
    "Ce programme ferait descendre le coureur sous son poids de sécurité.",
    "Un nutritionniste actif et un coureur de votre effectif sont requis.",
  ])("surfaces the RPC refusal without showing a success or refreshing stale results: %s", async (message) => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message } });
    await expect(applyWeightCutAction(payload("0.2"))).rejects.toThrow(`redirect:/jeu/centre-de-soin?onglet=nutrition&erreur=${encodeURIComponent(message)}`);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
