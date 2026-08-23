"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { useLocale } from "@/components/i18n/locale-provider";
import { useTutorial } from "@/components/tutorial/tutorial-provider";

const loadTutorialCenterMenu = () =>
  import("@/components/tutorial/tutorial-center-menu").then(
    (module) => module.TutorialCenterMenu,
  );

const DeferredTutorialCenterMenu = dynamic(loadTutorialCenterMenu, {
  ssr: false,
  loading: () => <TutorialCenterLoadingButton />,
});

export function TutorialCenterLauncher() {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [activated, setActivated] = useState(false);
  const { activeTutorial, isPending, progressByTutorialKey } = useTutorial();

  if (activated) {
    return <DeferredTutorialCenterMenu initiallyOpen />;
  }

  const tutorialIsActive = Boolean(activeTutorial);
  const disabled = tutorialIsActive || isPending;
  const hasTutorialInProgress = Object.values(progressByTutorialKey).some(
    (progress) => progress.status === "in_progress",
  );

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-label={
        tutorialIsActive
          ? isEnglish
            ? "A tutorial is already in progress"
            : "Un didacticiel est déjà en cours"
          : isEnglish
            ? "Open the tutorial centre"
            : "Ouvrir le centre des didacticiels"
      }
      title={
        tutorialIsActive
          ? isEnglish
            ? "A tutorial is already in progress"
            : "Un didacticiel est déjà en cours"
          : isEnglish
            ? "Open the tutorial centre"
            : "Ouvrir le centre des didacticiels"
      }
      disabled={disabled}
      onFocus={() => {
        void loadTutorialCenterMenu();
      }}
      onPointerEnter={() => {
        void loadTutorialCenterMenu();
      }}
      onClick={() => {
        setActivated(true);
      }}
      className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/20 bg-white/[0.035] text-[11px] font-extrabold text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.07] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
    >
      <span
        aria-hidden="true"
        className="grid h-5 w-5 place-items-center rounded-full border border-current text-[11px] font-black leading-none"
      >
        ?
      </span>
      {hasTutorialInProgress ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#071A17] bg-[#F2C94C]"
        />
      ) : null}
    </button>
  );
}

function TutorialCenterLoadingButton() {
  return (
    <button
      type="button"
      disabled
      aria-label="Chargement du centre des didacticiels"
      className="relative inline-flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-lg border border-[#D6DFD2]/20 bg-white/[0.035] text-[11px] font-extrabold text-[#D6DFD2] opacity-70 sm:h-10 sm:w-10"
    >
      <span
        aria-hidden="true"
        className="grid h-5 w-5 place-items-center rounded-full border border-current text-[11px] font-black leading-none"
      >
        ?
      </span>
    </button>
  );
}
