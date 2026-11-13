"use client";

import { createContext, useContext, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { registerDevelopmentRacesAction } from "@/app/jeu/centre-de-formation/development-actions";
import { useUnsavedManagementChanges } from "./use-management-draft";

type RegistrationDraft = { riderIds: string[]; complete: boolean };

const RegistrationContext = createContext<{
  drafts: Record<string, RegistrationDraft>;
  pending: boolean;
  setDraft: (raceEditionId: string, draft: RegistrationDraft | null) => void;
} | null>(null);

export function useDevelopmentRaceRegistrationDrafts() {
  const editor = useContext(RegistrationContext);
  if (!editor) throw new Error("Development race registration editor is missing");
  return editor;
}

export function DevelopmentRaceRegistrationEditor({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, RegistrationDraft>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const entries = Object.entries(drafts);
  const count = entries.length;
  const incomplete = entries.some(([, draft]) => !draft.complete);
  useUnsavedManagementChanges(count > 0);

  function setDraft(raceEditionId: string, draft: RegistrationDraft | null) {
    setFeedback(null);
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[raceEditionId] = draft;
      else delete next[raceEditionId];
      return next;
    });
  }

  function save() {
    if (pending || incomplete || count === 0) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await registerDevelopmentRacesAction(
          entries.map(([raceEditionId, { riderIds }]) => ({ raceEditionId, riderIds })),
        );
        if (result.ok) {
          setDrafts({});
          setFeedback({ ok: true, message: "Inscriptions enregistrées." });
        } else {
          setFeedback({ ok: false, message: result.message });
        }
      } catch {
        setFeedback({ ok: false, message: "L’enregistrement a échoué. Réessayez." });
      }
    });
  }

  return (
    <RegistrationContext.Provider value={{ drafts, pending, setDraft }}>
      <div role="status" className={feedback?.ok ? "mb-3 rounded-xl bg-[#E5F4ED] px-4 py-3 text-sm font-bold text-[#176951]" : undefined}>
        {feedback?.ok ? feedback.message : null}
      </div>
      {children}
      {count > 0 ? (
        <>
          <div aria-hidden="true" className="h-36 sm:h-24" />
          <div className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
            <div className="rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div aria-live="polite">
                  <p className="text-sm font-black">
                    {count === 1 ? "1 course modifiée" : `${count} courses modifiées`}
                  </p>
                  {incomplete ? (
                    <p className="mt-1 text-xs font-semibold text-[#FFE7A1]">
                      Complétez les sélections signalées.
                    </p>
                  ) : null}
                </div>
                <div className="grid w-full grid-cols-[auto_1fr] gap-2 sm:flex sm:w-auto">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setDrafts({});
                      setFeedback(null);
                    }}
                    className="min-h-11 rounded-xl px-3 text-xs font-black text-[#CDE2DA] hover:bg-white/10 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={pending || incomplete}
                    onClick={save}
                    className="min-h-11 rounded-xl bg-[#F2C94C] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Enregistrement…" : "Enregistrer les inscriptions"}
                  </button>
                </div>
              </div>
              {feedback && !feedback.ok ? (
                <p role="alert" className="mt-2 text-xs font-semibold text-[#FFE7A1]">
                  {feedback.message}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </RegistrationContext.Provider>
  );
}
