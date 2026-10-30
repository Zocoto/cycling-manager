import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), recover: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }));
vi.mock("@/services/empty-roster-recovery", () => ({ recoverCurrentEmptyTeamRoster: mocks.recover }));

import { recoverEmptyTeamRosterAction } from "./actions";

function lastRedirect() {
  return new URL(mocks.redirect.mock.calls.at(-1)?.[0], "https://cyclostratege.fr");
}

describe("empty-roster recovery action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: { id: "current-director" } }, error: null });
    mocks.recover.mockResolvedValue("created");
    mocks.redirect.mockImplementation((url: string): never => { throw new Error(`REDIRECT:${url}`); });
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "expired-user" } }, error: { message: "Session expired" } },
  ])("does not grant riders or invalidate pages without successful authentication (%j)", async authResult => {
    mocks.auth.mockResolvedValue(authResult);
    await expect(recoverEmptyTeamRosterAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("invalidates the game layout after recovery then returns to the effectif with feedback", async () => {
    await expect(recoverEmptyTeamRosterAction()).rejects.toThrow("REDIRECT:/jeu/effectif?succes=");
    expect(mocks.recover).toHaveBeenCalledOnce();
    expect(mocks.recover).toHaveBeenCalledWith({ auth: { getUser: mocks.auth } });
    expect(mocks.revalidate.mock.calls).toEqual([["/jeu", "layout"]]);
    expect(mocks.recover.mock.invocationCallOrder[0]).toBeLessThan(mocks.revalidate.mock.invocationCallOrder[0]);
    expect(mocks.revalidate.mock.invocationCallOrder[0]).toBeLessThan(mocks.redirect.mock.invocationCallOrder[0]);
    expect(lastRedirect().searchParams.get("succes")).toContain("7 coureurs de départ ont été créés");
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("acknowledges an idempotent recovery without announcing another seven riders", async () => {
    mocks.recover.mockResolvedValue("already_recovered");
    await expect(recoverEmptyTeamRosterAction()).rejects.toThrow("REDIRECT:/jeu/effectif?succes=");
    expect(lastRedirect().searchParams.get("succes")).toContain("La relance a déjà été enregistrée");
    expect(lastRedirect().searchParams.get("succes")).not.toContain("ont été créés");
    expect(mocks.revalidate.mock.calls).toEqual([["/jeu", "layout"]]);
  });

  it("returns an actionable failure and keeps cached pages intact when SQL rejects recovery", async () => {
    mocks.recover.mockRejectedValue(new Error("La relance d’effectif a déjà été utilisée cette saison."));
    await expect(recoverEmptyTeamRosterAction()).rejects.toThrow("REDIRECT:/jeu/effectif?erreur=");
    expect(lastRedirect().searchParams.get("erreur")).toContain("déjà été utilisée cette saison");
    expect(lastRedirect().searchParams.has("succes")).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("handles an unknown service failure without serializing internal objects", async () => {
    mocks.recover.mockRejectedValue({ secret: "private SQL context" });
    await expect(recoverEmptyTeamRosterAction()).rejects.toThrow("REDIRECT:/jeu/effectif?erreur=");
    expect(lastRedirect().searchParams.get("erreur")).toBe("Votre effectif n’a pas pu être relancé. Réessayez dans un instant.");
    expect(mocks.redirect.mock.calls[0][0]).not.toContain("private SQL context");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
