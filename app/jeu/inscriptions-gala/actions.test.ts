import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string): never => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));

import { savePcmGalaRegistrationAction, saveSeasonFinaleGalaRegistrationAction, withdrawSeasonFinaleGalaRegistrationAction } from "./actions";

function selection(eventKey = "gala-des-puncheurs", count = 7) {
  const data = new FormData(); data.set("eventKey", eventKey);
  for (let index = 0; index < count; index++) data.append("riderIds", `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  return data;
}

describe("inscriptions du gala hors compétition", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "team-owner" } }, error: null }); mocks.rpc.mockResolvedValue({ data: true, error: null }); });
  it("sauvegarde uniquement dans la RPC isolée et revient sur la nouvelle page", async () => {
    await expect(saveSeasonFinaleGalaRegistrationAction(selection())).rejects.toThrow("REDIRECT:/jeu/gala-fin-de-saison?inscription=");
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("save_current_team_pcm_gala_registration", { p_event_key: "gala-des-puncheurs", p_rider_ids: selection().getAll("riderIds") });
    expect(mocks.revalidate.mock.calls).toEqual([["/jeu/inscriptions-gala"], ["/jeu/gala-fin-de-saison"]]);
  });
  it("refuse un profil montagne injecté dans le formulaire", async () => {
    await expect(saveSeasonFinaleGalaRegistrationAction(selection("gala-des-sommets"))).rejects.toThrow("REDIRECT:/jeu/gala-fin-de-saison?erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuse les sélections incomplètes et les doublons", async () => {
    await expect(saveSeasonFinaleGalaRegistrationAction(selection("gala-des-puncheurs", 6))).rejects.toThrow("?erreur=");
    const duplicate = selection("gala-des-puncheurs", 6); duplicate.append("riderIds", String(duplicate.get("riderIds")));
    await expect(saveSeasonFinaleGalaRegistrationAction(duplicate)).rejects.toThrow("?erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ne modifie rien sans connexion", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    await expect(saveSeasonFinaleGalaRegistrationAction(selection())).rejects.toThrow("REDIRECT:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("respecte la fermeture contrôlée par la base", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Course fermée" } });
    await expect(saveSeasonFinaleGalaRegistrationAction(selection())).rejects.toThrow(encodeURIComponent("Les inscriptions à cette course sont closes."));
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("conserve l'ancienne page et ses trois profils", async () => {
    await expect(savePcmGalaRegistrationAction(selection("gala-des-sommets"))).rejects.toThrow("REDIRECT:/jeu/inscriptions-gala?inscription=");
  });
  it("retire l'inscription par la RPC existante, sans mutation sportive", async () => {
    await expect(withdrawSeasonFinaleGalaRegistrationAction()).rejects.toThrow("REDIRECT:/jeu/gala-fin-de-saison?inscription=");
    expect(mocks.rpc).toHaveBeenCalledWith("withdraw_current_team_pcm_gala_registration");
  });
});
