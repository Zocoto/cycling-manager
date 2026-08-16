"use client";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { useLocale } from "@/components/i18n/locale-provider";

export function TutorialLaunchButton({
  tutorialKey,
  iconOnly = false,
}: {
  tutorialKey: string;
  iconOnly?: boolean;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const {
    activeTutorial,
    getTutorialProgress,
    isPending,
    startTutorial,
  } = useTutorial();

  const progress =
    getTutorialProgress(tutorialKey);

  const isActive =
    activeTutorial?.definition.key ===
    tutorialKey;

  const label = isActive
    ? isEnglish
      ? "Tour in progress"
      : "Visite en cours"
    : progress?.status === "in_progress"
      ? isEnglish
        ? "Resume tour"
        : "Reprendre la visite"
      : progress?.status === "completed" ||
          progress?.status === "skipped"
        ? isEnglish
          ? "Replay tour"
          : "Revoir la visite"
        : isEnglish
          ? "Guided tour"
          : "Visite guidée";
  const accessibleLabel = `${label} · ${isEnglish ? "tutorial for this section" : "didacticiel de cette rubrique"}`;

  return (
    <button
      type="button"
      aria-label={iconOnly ? accessibleLabel : undefined}
      title={iconOnly ? accessibleLabel : undefined}
      disabled={isPending || isActive}
      onClick={() => {
        const launchSource =
          progress?.status === "in_progress"
            ? "resume"
            : progress?.status === "completed" ||
                progress?.status === "skipped"
              ? "replay"
              : "manual";

        void startTutorial({
          tutorialKey,
          launchSource,
          restartFromBeginning:
            launchSource !== "resume",
        });
      }}
      className={
        iconOnly
          ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#278B70]/25 bg-white/75 text-[#176951] shadow-[0_10px_24px_rgba(19,60,46,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#278B70]/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-not-allowed disabled:opacity-55"
          : "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#278B70]/25 bg-white/75 px-4 text-xs font-black text-[#176951] shadow-[0_12px_30px_rgba(19,60,46,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#278B70]/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-not-allowed disabled:opacity-55"
      }
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 place-items-center rounded-full bg-[#DDF3E7] text-sm"
      >
        ?
      </span>
      {iconOnly ? null : label}
    </button>
  );
}
