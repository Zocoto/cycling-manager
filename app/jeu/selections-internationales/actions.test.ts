import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.user } }) }));
vi.mock("@/services/international-championship-selections", () => ({ respondToInternationalChampionshipSelections: vi.fn() }));
import { answerFederationCallupAction } from "./actions";
const memberId = "71adc9a8-5df8-48c5-a6d4-7f2cc634f379";
function payload(decision: string | null, audience = "professional") {
  const form = new FormData();
  form.set("memberId", memberId); form.set("audience", audience);
  if (decision !== null) form.set("decision", decision);
  return form;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: "confirmed", error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: "owner" } } });
});
describe("réponse aux convocations fédérales", () => {
  it("reproduit le rejet signalé quand le formulaire ne contient pas la décision du bouton", async () => {
    await expect(answerFederationCallupAction(payload(null))).rejects.toThrow("Décision%20invalide");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["professional", "junior"])("transmet les champs du formulaire %s sans dépendre du bouton cliqué", async audience => {
    for (const decision of ["confirm", "decline"]) {
      await expect(answerFederationCallupAction(payload(decision, audience))).rejects.toThrow(`REDIRECT:/jeu/selections-internationales${audience === "junior" ? "?categorie=junior" : ""}`);
      expect(mocks.rpc).toHaveBeenLastCalledWith("respond_to_national_federation_preselection", { p_member_id: memberId, p_accept: decision === "confirm" });
    }
  });
  it("affiche un motif explicite après une invalidation enregistrée par le serveur", async () => {
    mocks.rpc.mockResolvedValue({ data: "ineligible", error: null });
    await expect(answerFederationCallupAction(payload("confirm"))).rejects.toThrow(encodeURIComponent("Cette convocation n’est plus valable : le coureur n’est plus éligible."));
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/selections-internationales");
  });
  it("ne masque pas une erreur SQL et ne fait aucun traitement global", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Cette demande a déjà été traitée." } });
    await expect(answerFederationCallupAction(payload("confirm"))).rejects.toThrow(encodeURIComponent("Cette demande a déjà été traitée."));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("bloque une session absente", async () => {
    mocks.user.mockResolvedValue({ data: { user: null } });
    await expect(answerFederationCallupAction(payload("confirm"))).rejects.toThrow("REDIRECT:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
