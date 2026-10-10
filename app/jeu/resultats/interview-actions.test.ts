import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), submit: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }));
vi.mock("@/services/post-race-interviews", () => ({ submitPostRaceInterview: mocks.submit }));

import { submitPostRaceInterviewAction } from "./interview-actions";

const input = {
  interviewId: "d291371c-56f6-4a6c-b9f7-0d5c4b1ee5f1",
  answers: ["Notre équipe a bien couru.", "Nous continuerons à progresser."],
  closingNote: "Merci aux supporters.",
  eventChoiceId: "praise-rival",
};

describe("validation de la zone mixte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: { id: "authenticated-owner" } }, error: null });
    mocks.submit.mockResolvedValue({ id: input.interviewId, status: "submitted" });
  });

  it("enregistre la décision avec l'identité authentifiée et renvoie l'interview", async () => {
    const result = await submitPostRaceInterviewAction(input);
    expect(result).toEqual({ ok: true, interview: { id: input.interviewId, status: "submitted" } });
    expect(mocks.submit).toHaveBeenCalledWith({ ...input, authUserId: "authenticated-owner" });
    expect(mocks.revalidate.mock.calls).toEqual([["/jeu/resultats", "layout"], ["/jeu/gazette"]]);
  });

  it("renvoie les erreurs de validation sans exception ni écriture", async () => {
    const result = await submitPostRaceInterviewAction({ ...input, answers: ["x"] });
    expect(result.ok).toBe(false);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur déconnecté sans appeler la soumission", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect(await submitPostRaceInterviewAction(input)).toEqual({ ok: false, message: "Vous devez être connecté pour répondre à l’interview." });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it.each([
    "La zone mixte est fermée : l’interview est disponible uniquement le jour de la course, avant 20 h.",
    "Cette interview ne vous appartient pas ou n’existe plus.",
    "La trésorerie de l’équipe est insuffisante pour cette réaction.",
  ])("renvoie une erreur de jeu lisible : %s", async (message) => {
    mocks.submit.mockRejectedValue(new Error(message));
    expect(await submitPostRaceInterviewAction(input)).toEqual({ ok: false, message });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("journalise une panne serveur sans divulguer de détails techniques au joueur", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const error = new Error('new row for relation "reward_events" violates check constraint "reward_events_values_valid"');
      mocks.submit.mockRejectedValue(error);
      const result = await submitPostRaceInterviewAction(input);
      expect(result).toEqual({ ok: false, message: "L’interview n’a pas pu être enregistrée. Vos réponses sont conservées ; réessayez dans un instant." });
      expect(log).toHaveBeenCalledWith("Échec de l’enregistrement de l’interview de zone mixte :", error);
      expect(mocks.revalidate).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("accepte aussi les trois réponses d'une interview sans événement", async () => {
    expect((await submitPostRaceInterviewAction({ ...input, answers: [...input.answers, "La suite sera intéressante."], eventChoiceId: null })).ok).toBe(true);
  });
});
