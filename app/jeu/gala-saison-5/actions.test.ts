import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), abort: vi.fn(), path: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));

import { saveSeasonFiveGalaRegistrationAction, withdrawSeasonFiveGalaRegistrationAction } from "./actions";
import { initialGalaS5RegistrationState } from "@/lib/game/season-five-gala-registration";

const ids = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const selections = { "pt-zoncolan": ids.slice(0, 7), "pt-liege": [], "pt-hamburg": [] };
function form(value: unknown = selections, previousProgram = "") {
  const data = new FormData();
  data.set("program", "pro-tour");
  data.set("selections", JSON.stringify(value));
  data.set("previousProgram", previousProgram);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "58140add-54c6-40af-9528-f823d0051d0f" } }, error: null });
  mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
  mocks.abort.mockResolvedValue({ data: "registration-id", error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("season five gala official registration actions", () => {
  it.each([saveSeasonFiveGalaRegistrationAction, withdrawSeasonFiveGalaRegistrationAction])("requires a valid session for each mutation", async (action) => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await action(initialGalaS5RegistrationState, form())).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([saveSeasonFiveGalaRegistrationAction, withdrawSeasonFiveGalaRegistrationAction])("allows authenticated DS mutations through the ownership-checking RPC", async (action) => {
    mocks.auth.mockResolvedValue({ data: { user: { id: ids[0] } }, error: null });
    expect((await action(initialGalaS5RegistrationState, form())).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("saves selected courses atomically in one RPC and only refreshes the gala page", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    expect((await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form())).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_current_season_five_gala_registration", {
      p_program: "pro-tour", p_selections: selections, p_previous_program: null,
    });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(8000);
    expect(mocks.path).toHaveBeenCalledExactlyOnceWith("/jeu/gala-saison-5");
  });

  it("forwards the previous program to protect explicit category changes from stale forms", async () => {
    await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form(selections, "continental"));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_current_season_five_gala_registration", {
      p_program: "pro-tour", p_selections: selections, p_previous_program: "continental",
    });
  });

  it("allows Gouille to prepare an inscription", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "ee244935-5722-4626-a28f-dc3cf63aa6f4" } }, error: null });
    expect((await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form())).status).toBe("success");
  });

  it.each([
    { ...selections, "pt-zoncolan": ids.slice(0, 6) },
    { ...selections, "pt-zoncolan": Array(7).fill(ids[0]) },
    { "pt-zoncolan": ids.slice(0, 7), "pt-liege": [], "ct-alpe": [] },
    { "pt-zoncolan": [], "pt-liege": [], "pt-hamburg": [] },
    { ...selections, teamId: ids[0] },
  ])("rejects invalid or mixed compositions before calling SQL", async (value) => {
    expect((await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form(value))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized JSON", async () => {
    for (const value of ["{", " ".repeat(16385)]) {
      const data = form();
      data.set("selections", value);
      expect((await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, data)).status).toBe("error");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("withdraws through the ownership-checked RPC", async () => {
    expect((await withdrawSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, new FormData())).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("withdraw_current_season_five_gala_registration");
    expect(mocks.path).toHaveBeenCalledExactlyOnceWith("/jeu/gala-saison-5");
  });

  it.each([
    [{ message: "Les inscriptions du gala sont closes." }, "Les inscriptions du gala sont closes."],
    [{ message: "Votre catégorie a changé. Rechargez la page avant de continuer." }, "Votre programme a changé."],
    [{ code: "40001", message: "serialization failure" }, "Une inscription est déjà en cours."],
    [{ message: "Coureur hors effectif de saison 5 ou inéligible" }, "Vérifiez votre effectif de saison 5"],
    [{ message: "Un coureur est déjà inscrit par une autre équipe pour ce gala. Contactez l’organisation." }, "Un coureur est déjà inscrit par une autre équipe pour ce gala. Contactez l’organisation."],
    [{ message: "relation private.fixture does not exist" }, "Confirmation indisponible."],
  ])("reports controlled error messages and keeps a failed save unconfirmed", async (error, expected) => {
    mocks.abort.mockResolvedValue({ data: null, error });
    const state = await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form());
    expect(state.status).toBe("error");
    expect(state.message).toContain(expected);
    expect(mocks.path).not.toHaveBeenCalled();
  });

  it("requires a reload after a timeout instead of retrying an uncertain mutation", async () => {
    mocks.abort.mockRejectedValue(new Error("AbortError"));
    const state = await saveSeasonFiveGalaRegistrationAction(initialGalaS5RegistrationState, form());
    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("Rechargez la page") });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.path).not.toHaveBeenCalled();
  });
});
