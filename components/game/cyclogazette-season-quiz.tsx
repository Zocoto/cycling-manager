"use client";

import { useActionState } from "react";

import {
  validateCyclogazetteSeasonQuizAction,
  type CyclogazetteSeasonQuizActionState,
} from "@/app/jeu/gazette/actions";
import type { CyclogazetteSeasonQuizOverview } from "@/services/cyclogazette-season-quiz";

const INITIAL_STATE: CyclogazetteSeasonQuizActionState = {
  result: "idle",
  correctAnswers: 0,
  rewardCash: 0,
  answers: {},
  correctOptionIds: {},
  alreadyCompleted: false,
};

export function CyclogazetteSeasonQuiz({
  overview,
}: {
  overview: CyclogazetteSeasonQuizOverview;
}) {
  const [state, formAction, pending] = useActionState(
    validateCyclogazetteSeasonQuizAction,
    INITIAL_STATE,
  );
  const completed = Boolean(overview.attempt) || state.result === "success";
  const answers =
    state.result === "success"
      ? state.answers
      : (overview.attempt?.answers ?? {});
  const correctOptionIds =
    state.result === "success"
      ? state.correctOptionIds
      : (overview.attempt?.correctOptionIds ?? {});
  const correctAnswers =
    state.result === "success"
      ? state.correctAnswers
      : (overview.attempt?.correctAnswers ?? 0);
  const rewardCash =
    state.result === "success"
      ? state.rewardCash
      : (overview.attempt?.rewardCash ?? 0);

  return (
    <section
      data-cyclogazette-season-quiz="season-2"
      className="relative overflow-hidden border-y border-[#D6B45A]/55 bg-[#090D18] px-5 py-8 text-[#F8F2DF] sm:px-8 sm:py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(214,180,90,.24),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(95,122,180,.2),transparent_30%),repeating-linear-gradient(120deg,transparent_0,transparent_38px,rgba(214,180,90,.035)_39px,transparent_40px)]"
      />
      <div className="relative">
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#D6B45A]">
            Bonus de fin de saison
          </p>
          <h2 className="mt-2 font-serif text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            Le grand quiz de la saison 2
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-serif text-sm italic leading-6 text-[#D9D2C0]">
            Dix souvenirs du peloton, du mercato et des classements. Chaque
            bonne réponse rapporte {formatCash(overview.rewardPerCorrectAnswer)} €,
            dans la limite d’une participation par Directeur Sportif.
          </p>
        </header>

        <form action={formAction} className="mx-auto mt-8 max-w-5xl">
          <input type="hidden" name="editionId" value={overview.editionId} />
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.questions.map((question, questionIndex) => (
              <fieldset
                key={question.id}
                className="border border-[#D6B45A]/35 bg-[#111827]/90 p-4 sm:p-5"
              >
                <legend className="sr-only">Question {questionIndex + 1}</legend>
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D6B45A]/70 font-serif text-sm font-black text-[#E8CB78]">
                    {questionIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="min-h-12 font-serif text-sm font-black leading-5 sm:text-base">
                      {question.question}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {question.options.map((option) => {
                        const selected = answers[question.id] === option.id;
                        const correct =
                          correctOptionIds[question.id] === option.id;
                        const resultClass = completed
                          ? correct
                            ? "border-[#58B981] bg-[#153A2B] text-[#DDF9E8]"
                            : selected
                              ? "border-[#DB6A6A] bg-[#402022] text-[#FFE5E5]"
                              : "border-white/10 bg-white/[.025] text-[#A7AAB3]"
                          : "border-white/15 bg-white/[.045] text-[#E8E2D3] hover:border-[#D6B45A]/60 hover:bg-[#D6B45A]/10";
                        return (
                          <label
                            key={option.id}
                            className={`flex min-h-10 items-center gap-3 border px-3 py-2 text-xs font-bold transition ${resultClass}`}
                          >
                            <input
                              type="radio"
                              name={`quiz-${question.id}`}
                              value={option.id}
                              defaultChecked={selected}
                              disabled={completed || !overview.isPlayable || pending}
                              className="h-4 w-4 accent-[#D6B45A]"
                            />
                            <span>{option.label}</span>
                            {completed && correct ? (
                              <span className="ml-auto text-[#75D69C]" aria-label="Bonne réponse">
                                ✓
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </fieldset>
            ))}
          </div>

          {completed ? (
            <div
              role="status"
              className="mt-6 border border-[#D6B45A]/60 bg-[#D6B45A]/10 px-5 py-5 text-center"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E8CB78]">
                Participation enregistrée
              </p>
              <p className="mt-2 font-serif text-3xl font-black">
                {correctAnswers}/10 · {formatCash(rewardCash)} €
              </p>
              <p className="mt-2 text-xs text-[#D9D2C0]">
                Le bonus a été crédité une seule fois dans les finances de votre équipe.
              </p>
            </div>
          ) : overview.isPlayable ? (
            <div className="mt-6 text-center">
              {state.result === "incomplete" ? (
                <p role="alert" className="mb-3 text-xs font-bold text-[#FFB5A9]">
                  Répondez aux dix questions avant de valider définitivement.
                </p>
              ) : state.result === "failure" ? (
                <p role="alert" className="mb-3 text-xs font-bold text-[#FFB5A9]">
                  La participation n’a pas pu être enregistrée. Réessayez dans un instant.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="min-h-12 border border-[#F0D78F] bg-[#D6B45A] px-7 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#101522] transition hover:bg-[#E8CB78] disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Correction en cours…" : "Valider mes 10 réponses"}
              </button>
              <p className="mt-2 text-[10px] text-[#9EA3B0]">
                La validation est définitive : prenez le temps de relire vos choix.
              </p>
            </div>
          ) : (
            <p className="mt-6 border border-white/15 bg-white/[.04] px-4 py-4 text-center text-xs text-[#C8C4BA]">
              Le quiz n’attribue des gains que dans la dernière édition publiée.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function formatCash(value: number) {
  return Math.max(0, Math.trunc(value)).toLocaleString("fr-FR");
}
