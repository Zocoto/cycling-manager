"use client";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { useLocale } from "@/components/i18n/locale-provider";
import { CRITERIUM_DISCOVERY_KEY } from "@/lib/tutorial/criterium-discovery";

export function CriteriumCompletionButton() {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const { activeTutorial, isPending, startTutorial } = useTutorial();

  const criteriumIsActive =
    activeTutorial?.definition.key === CRITERIUM_DISCOVERY_KEY;

  return (
    <button
      type="button"
      disabled={isPending || criteriumIsActive}
      onClick={() => {
        void startTutorial({
          tutorialKey: CRITERIUM_DISCOVERY_KEY,
          launchSource: "resume",
          restartFromBeginning: false,
        });
      }}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-6 text-sm font-black text-[#071A17] shadow-md transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {isPending
        ? isEnglish
          ? "Resuming…"
          : "Reprise…"
        : criteriumIsActive
          ? isEnglish
            ? "Tutorial in progress"
            : "Accompagnement en cours"
          : isEnglish
            ? "Resume tutorial"
            : "Reprendre l’accompagnement"}
    </button>
  );
}
