"use client";

import type { TutorialStep } from "@/types/tutorial";
import { useLocale } from "@/components/i18n/locale-provider";

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
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const actionLabel = errorMessage
    ? isEnglish
      ? "Try again"
      : "Réessayer"
    : isPending
      ? isEnglish
        ? "Preparing…"
        : "Préparation…"
      : isEnglish
        ? "Start"
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
      <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-[1.25rem] border border-white/15 bg-[#FFFDF4] text-[#16342D] shadow-[0_32px_110px_rgba(0,0,0,0.48)] sm:rounded-[1.75rem]">
        <div className="border-b border-[#315B3E]/10 bg-[#E9F5F0] px-4 py-3 sm:px-8 sm:py-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
            {tutorialTitle}
          </p>

          <h1
            id="instant-tutorial-title"
            className="mt-1 text-xl font-black tracking-[-0.025em] text-[#0B302B] sm:mt-2 sm:text-3xl"
          >
            {step.title}
          </h1>
        </div>

        <div className="px-4 py-3 sm:px-8 sm:py-6">
          <p
            id="instant-tutorial-description"
            className="whitespace-pre-line text-[13px] font-semibold leading-5 text-[#35554D] sm:text-base sm:leading-7"
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
              className="mt-3 rounded-xl border border-[#278B70]/15 bg-[#F1F8F5] px-3 py-2.5 sm:mt-5 sm:px-4 sm:py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#278B70]"
                />
                <p className="text-xs font-bold text-[#48665F]">
                  {isPending
                    ? isEnglish
                      ? "Your tutorial is being prepared."
                      : "Votre parcours est en cours de préparation."
                    : isEnglish
                      ? "Your tutorial can start immediately."
                      : "Votre parcours peut commencer immédiatement."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#315B3E]/10 bg-white px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={onSkip}
            disabled={isPending}
            className="min-h-10 rounded-xl px-2 text-xs font-bold text-[#6B7F79] underline decoration-[#6B7F79]/35 underline-offset-4 transition hover:text-[#8B302E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-wait disabled:opacity-45 sm:min-h-11 sm:px-4 sm:text-sm"
          >
            {isEnglish ? "Skip tutorial" : "Passer le didacticiel"}
          </button>

          <button
            type="button"
            onClick={onStart}
            disabled={isPending}
            className="min-h-10 rounded-xl bg-[#176951] px-3 text-xs font-black text-white shadow-md transition hover:bg-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 sm:min-h-12 sm:px-6 sm:text-sm"
          >
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
