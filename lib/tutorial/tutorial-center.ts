import type {
  TutorialProgressStatus,
  TutorialSessionLaunchSource,
} from "@/types/tutorial";
import type { AppLocale } from "@/lib/i18n/config";

export type TutorialCenterEntryPresentation = {
  statusLabel: string;
  actionLabel: string;
  launchSource: TutorialSessionLaunchSource;
  restartFromBeginning: boolean;
  needsAttention: boolean;
};

export function getTutorialCenterEntryPresentation(
  status: TutorialProgressStatus | null,
  locale: AppLocale = "fr",
): TutorialCenterEntryPresentation {
  const isEnglish = locale === "en";

  switch (status) {
    case "in_progress":
      return {
        statusLabel: isEnglish ? "In progress" : "En cours",
        actionLabel: isEnglish ? "Resume" : "Reprendre",
        launchSource: "resume",
        restartFromBeginning: false,
        needsAttention: true,
      };

    case "completed":
      return {
        statusLabel: isEnglish ? "Completed" : "Terminé",
        actionLabel: isEnglish ? "Replay from the start" : "Revoir depuis le début",
        launchSource: "replay",
        restartFromBeginning: true,
        needsAttention: false,
      };

    case "skipped":
      return {
        statusLabel: isEnglish ? "Skipped" : "Ignoré",
        actionLabel: isEnglish ? "Discover now" : "Découvrir maintenant",
        launchSource: "replay",
        restartFromBeginning: true,
        needsAttention: false,
      };

    case "not_started":
    case null:
      return {
        statusLabel: isEnglish ? "Not started" : "À découvrir",
        actionLabel: isEnglish ? "Start" : "Commencer",
        launchSource: "manual",
        restartFromBeginning: true,
        needsAttention: false,
      };
  }
}
