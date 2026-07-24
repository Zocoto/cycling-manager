"use client";

import type { TutorialStep } from "@/types/tutorial";

type TutorialInstantIntroProps = {
  tutorialTitle: string;
  step: TutorialStep;
  isPending: boolean;
  errorMessage: string | null;
  onStart: () => void;
  onSkip: () => void;
};

export function TutorialInstantIntro({
  tutorialTitle,
  step,
  isPending,
  errorMessage,
  onStart,
  onSkip,
}: TutorialInstantIntroProps) {
  const actionLabel = errorMessage
    ? "Réessayer"
    : isPending
      ? "Préparation…"
      : "Commencer";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="instant-tutorial-title"
      aria-describedby="instant-tutorial-description"
      className="fixed inset-0 z-[240] grid place-items-center overflow-y-auto bg-[#071A17]/82 p-3 backdrop-blur-sm sm:p-6"
      data-tutorial-instant-intro="true"
    >
      <section className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#FFFDF4] text-[#16342D] shadow-[0_32px_110px_rgba(0,0,0,0.48)]">
        <div className="border-b border-[#315B3E]/10 bg-[#E9F5F0] px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
            {tutorialTitle}
          </p>

          <h1
            id="instant-tutorial-title"
            className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#0B302B] sm:text-3xl"
          >
            {step.title}
          </h1>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <p
            id="instant-tutorial-description"
            className="whitespace-pre-line text-sm font-semibold leading-7 text-[#35554D] sm:text-base"
          >
            {step.content}
          </p>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-[#B94A48]/20 bg-[#FDEDEC] px-4 py-3 text-sm font-bold leading-6 text-[#8B302E]"
            >
              {errorMessage}
            </p>
          ) : (
            <div
              aria-live="polite"
              className="mt-5 rounded-xl border border-[#278B70]/15 bg-[#F1F8F5] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#278B70]"
                />
                <p className="text-xs font-bold text-[#48665F]">
                  {isPending
                    ? "Votre parcours est en cours de préparation."
                    : "Votre parcours peut commencer immédiatement."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#315B3E]/10 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <button
            type="button"
            onClick={onSkip}
            disabled={isPending}
            className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#6B7F79] underline decoration-[#6B7F79]/35 underline-offset-4 transition hover:text-[#8B302E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-45"
          >
            Passer le didacticiel
          </button>

          <button
            type="button"
            onClick={onStart}
            disabled={isPending}
            className="min-h-12 rounded-xl bg-[#176951] px-6 text-sm font-black text-white shadow-md transition hover:bg-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
          >
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
