"use client";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { CRITERIUM_DISCOVERY_KEY } from "@/lib/tutorial/criterium-discovery";

export function CriteriumCompletionButton() {
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
        ? "Reprise…"
        : criteriumIsActive
          ? "Accompagnement en cours"
          : "Reprendre l’accompagnement"}
    </button>
  );
}
