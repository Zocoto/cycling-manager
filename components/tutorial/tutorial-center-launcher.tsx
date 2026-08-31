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
      className="tutorial-floating-launcher inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#FFFDF4]/90 bg-[#0B302B] text-sm font-extrabold text-[#FFFDF4] shadow-[0_14px_38px_rgba(7,26,23,0.36),0_0_0_3px_rgba(242,201,76,0.34)] transition hover:-translate-y-0.5 hover:border-[#F2C94C] hover:text-[#F2C94C] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#D94B57]/55 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-full border-2 border-current text-sm font-black leading-none"
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
      className="tutorial-floating-launcher inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-full border-2 border-[#FFFDF4]/90 bg-[#0B302B] text-sm font-extrabold text-[#FFFDF4] opacity-70 shadow-[0_14px_38px_rgba(7,26,23,0.36)]"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-full border-2 border-current text-sm font-black leading-none"
      >
        ?
      </span>
    </button>
  );
}
